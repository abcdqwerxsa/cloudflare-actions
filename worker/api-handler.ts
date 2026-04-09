import { dispatchTask } from './cron-handler';
import type { Env, Task, TaskFile, Execution, CreateTaskInput, UpdateTaskInput, TaskFileInput } from './types';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

export async function handleApi(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.startsWith('/api/') ? url.pathname.slice(5) : url.pathname.slice(1);
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      },
    });
  }

  try {
    // Tasks
    if (path === 'tasks' && method === 'GET') return await listTasks(env, url);
    if (path === 'tasks' && method === 'POST') return await createTask(request, env);

    const taskMatch = path.match(/^tasks\/([a-f0-9-]+)$/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      if (method === 'GET') return await getTask(env, taskId);
      if (method === 'PUT') return await updateTask(request, env, taskId);
      if (method === 'DELETE') return await deleteTask(env, taskId);
    }

    // Task trigger
    const triggerMatch = path.match(/^tasks\/([a-f0-9-]+)\/trigger$/);
    if (triggerMatch && method === 'POST') {
      return await triggerTask(env, triggerMatch[1], ctx);
    }

    // Executions
    if (path === 'executions' && method === 'GET') return await listExecutions(env, url);

    const execMatch = path.match(/^executions\/([a-f0-9-]+)$/);
    if (execMatch && method === 'GET') {
      return await getExecution(env, execMatch[1]);
    }

    // Internal: container reports logs
    const execLogsMatch = path.match(/^executions\/([a-f0-9-]+)\/logs$/);
    if (execLogsMatch && method === 'PUT') {
      return await updateExecutionLogs(request, env, execLogsMatch[1]);
    }

    // API Keys
    if (path === 'keys' && method === 'GET') return await listKeys(env);
    if (path === 'keys' && method === 'POST') return await createKey(request, env);

    const keyMatch = path.match(/^keys\/([a-f0-9-]+)$/);
    if (keyMatch && method === 'DELETE') {
      return await deleteKey(env, keyMatch[1]);
    }

    return error('Not found', 404);
  } catch (err: any) {
    console.error('API error:', err);
    return error(err.message || 'Internal server error', 500);
  }
}

// --- Tasks ---

async function listTasks(env: Env, url: URL) {
  const status = url.searchParams.get('status');
  let query = 'SELECT * FROM tasks ORDER BY created_at DESC';
  const binds: any[] = [];
  if (status) {
    query = 'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC';
    binds.push(status);
  }
  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ tasks: results });
}

async function createTask(request: Request, env: Env) {
  const body = await request.json() as CreateTaskInput;
  if (!body.name) return error('name is required');
  if (!body.files || body.files.length === 0) return error('at least one file is required');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const entrypoint = body.entrypoint || 'run.sh';

  const hasEntrypoint = body.files.some(f => f.file_path === entrypoint);
  if (!hasEntrypoint) return error(`entrypoint file "${entrypoint}" not found in files`);

  // Batch insert task + files
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO tasks (id, name, description, status, schedule, entrypoint, env_vars, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`
    ).bind(id, body.name, body.description || '', body.schedule || null,
      entrypoint, body.env_vars ? JSON.stringify(body.env_vars) : '{}', now, now),
  ];

  for (const file of body.files) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO task_files (id, task_id, file_path, content, is_entrypoint, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), id, file.file_path, file.content,
        file.file_path === entrypoint ? 1 : 0, now, now)
    );
  }

  await env.DB.batch(stmts);

  return await getTask(env, id);
}

async function getTask(env: Env, taskId: string) {
  const [task, { results: files }] = await Promise.all([
    env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first(),
    env.DB.prepare('SELECT * FROM task_files WHERE task_id = ? ORDER BY file_path').bind(taskId).all(),
  ]);
  if (!task) return error('Task not found', 404);
  return json({ task: { ...task, files } }, 200);
}

async function updateTask(request: Request, env: Env, taskId: string) {
  const body = await request.json() as UpdateTaskInput;
  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  if (!task) return error('Task not found', 404);

  const sets: string[] = [];
  const values: any[] = [];

  const fields: Record<string, any> = {
    name: body.name, description: body.description, status: body.status,
    schedule: body.schedule, entrypoint: body.entrypoint,
  };

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) { sets.push(`${key} = ?`); values.push(val); }
  }

  if (body.env_vars !== undefined) {
    sets.push('env_vars = ?');
    values.push(typeof body.env_vars === 'string' ? body.env_vars : JSON.stringify(body.env_vars));
  }

  if (sets.length > 0) {
    sets.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(taskId);
    await env.DB.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  // Replace all files if provided
  if (body.files && body.files.length > 0) {
    const now = new Date().toISOString();
    const entrypoint = body.entrypoint || (task as any).entrypoint || 'run.sh';
    const delStmt = env.DB.prepare('DELETE FROM task_files WHERE task_id = ?').bind(taskId);
    const insertStmts = body.files.map(file =>
      env.DB.prepare(
        `INSERT INTO task_files (id, task_id, file_path, content, is_entrypoint, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), taskId, file.file_path, file.content,
        file.file_path === entrypoint ? 1 : 0, now, now)
    );
    await env.DB.batch([delStmt, ...insertStmts]);
  }

  return await getTask(env, taskId);
}

async function deleteTask(env: Env, taskId: string) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM executions WHERE task_id = ?').bind(taskId),
    env.DB.prepare('DELETE FROM task_files WHERE task_id = ?').bind(taskId),
    env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId),
  ]);
  return json({ success: true });
}

async function triggerTask(env: Env, taskId: string, ctx: ExecutionContext) {
  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  if (!task) return error('Task not found', 404);

  const executionId = await dispatchTask(env, taskId, 'manual', ctx);
  return json({ executionId });
}

// --- Executions ---

async function listExecutions(env: Env, url: URL) {
  const taskId = url.searchParams.get('task_id');
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = 'SELECT e.*, t.name as task_name FROM executions e LEFT JOIN tasks t ON e.task_id = t.id';
  const conditions: string[] = [];
  const binds: any[] = [];

  if (taskId) { conditions.push('e.task_id = ?'); binds.push(taskId); }
  if (status) { conditions.push('e.status = ?'); binds.push(status); }

  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY e.created_at DESC LIMIT ?';
  binds.push(limit);

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ executions: results });
}

async function getExecution(env: Env, executionId: string) {
  const exec = await env.DB.prepare(
    'SELECT e.*, t.name as task_name FROM executions e LEFT JOIN tasks t ON e.task_id = t.id WHERE e.id = ?'
  ).bind(executionId).first();
  if (!exec) return error('Execution not found', 404);
  return json({ execution: exec });
}

// --- API Keys ---

async function listKeys(env: Env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, key_prefix, last_used_at, created_at FROM api_keys ORDER BY created_at DESC'
  ).all();
  return json({ keys: results });
}

async function createKey(request: Request, env: Env) {
  const body = await request.json() as { name: string };
  if (!body.name) return error('name is required');

  const id = crypto.randomUUID();
  const rawKey = `cf_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyPrefix = rawKey.slice(0, 8);

  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  await env.DB.prepare(
    'INSERT INTO api_keys (id, name, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.name, keyHash, keyPrefix, new Date().toISOString()).run();

  return json({ key: rawKey, id, name: body.name }, 201);
}

async function deleteKey(env: Env, keyId: string) {
  await env.DB.prepare('DELETE FROM api_keys WHERE id = ?').bind(keyId).run();
  return json({ success: true });
}

// --- Internal: Log reporting from containers ---

async function updateExecutionLogs(request: Request, env: Env, executionId: string) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON', 400);
  }
  if (typeof body.logs !== 'string') return error('logs must be a string');

  await env.DB.prepare(
    'UPDATE executions SET logs = ? WHERE id = ?'
  ).bind(body.logs, executionId).run();

  return json({ success: true });
}
