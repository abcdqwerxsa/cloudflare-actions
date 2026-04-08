import { dispatchTask } from './cron-handler';
import type { Env, Task, Execution, CreateTaskInput, UpdateTaskInput } from './types';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  // Path is already normalized by index.ts (stripped /api prefix)
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

    // Task by ID: tasks/xxx
    const taskMatch = path.match(/^tasks\/([a-f0-9-]+)$/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      if (method === 'GET') return await getTask(env, taskId);
      if (method === 'PUT') return await updateTask(request, env, taskId);
      if (method === 'DELETE') return await deleteTask(env, taskId);
    }

    // Task trigger: tasks/xxx/trigger
    const triggerMatch = path.match(/^tasks\/([a-f0-9-]+)\/trigger$/);
    if (triggerMatch && method === 'POST') {
      return await triggerTask(env, triggerMatch[1]);
    }

    // Executions
    if (path === 'executions' && method === 'GET') return await listExecutions(env, url);

    const execMatch = path.match(/^executions\/([a-f0-9-]+)$/);
    if (execMatch && method === 'GET') {
      return await getExecution(env, execMatch[1]);
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
  if (!body.name || !body.type) return error('name and type are required');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO tasks (id, name, description, type, status, schedule, runtime, code, docker_image, command, git_url, git_branch, git_command, env_vars, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.name, body.description || '', body.type,
    body.schedule || null, body.runtime || null, body.code || '',
    body.docker_image || null, body.command || null,
    body.git_url || null, body.git_branch || 'main', body.git_command || null,
    body.env_vars ? JSON.stringify(body.env_vars) : '{}',
    now, now
  ).run();

  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
  return json({ task }, 201);
}

async function getTask(env: Env, taskId: string) {
  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  if (!task) return error('Task not found', 404);
  return json({ task });
}

async function updateTask(request: Request, env: Env, taskId: string) {
  const body = await request.json() as UpdateTaskInput;
  const sets: string[] = [];
  const values: any[] = [];

  const fields: Record<string, any> = {
    name: body.name, description: body.description, status: body.status,
    schedule: body.schedule, runtime: body.runtime, code: body.code,
    docker_image: body.docker_image, command: body.command,
    git_url: body.git_url, git_branch: body.git_branch, git_command: body.git_command,
  };

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) { sets.push(`${key} = ?`); values.push(val); }
  }

  if (body.env_vars !== undefined) {
    sets.push('env_vars = ?');
    values.push(typeof body.env_vars === 'string' ? body.env_vars : JSON.stringify(body.env_vars));
  }

  if (sets.length === 0) return error('No fields to update');

  sets.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(taskId);

  await env.DB.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();

  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  return json({ task });
}

async function deleteTask(env: Env, taskId: string) {
  await env.DB.prepare('DELETE FROM executions WHERE task_id = ?').bind(taskId).run();
  await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();
  return json({ success: true });
}

async function triggerTask(env: Env, taskId: string) {
  const task = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  if (!task) return error('Task not found', 404);

  const executionId = await dispatchTask(env, taskId, 'manual');
  return json({ executionId });
}

// --- Executions ---

async function listExecutions(env: Env, url: URL) {
  const taskId = url.searchParams.get('task_id');
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '50');

  let query = 'SELECT e.*, t.name as task_name, t.type as task_type FROM executions e LEFT JOIN tasks t ON e.task_id = t.id';
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
    'SELECT e.*, t.name as task_name, t.type as task_type FROM executions e LEFT JOIN tasks t ON e.task_id = t.id WHERE e.id = ?'
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

  // Hash the key using SHA-256
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
