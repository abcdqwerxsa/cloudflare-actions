import type { Env, Task } from './types';

/**
 * Evaluates whether a cron expression matches the current time.
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 */
function matchesCron(expression: string, now: Date): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  const minute = now.getMinutes();
  const hour = now.getHours();
  const dayOfMonth = now.getDate();
  const month = now.getMonth() + 1;
  const dayOfWeek = now.getDay(); // 0 = Sunday

  const cronMinute = fields[0];
  const cronHour = fields[1];
  const cronDayOfMonth = fields[2];
  const cronMonth = fields[3];
  const cronDayOfWeek = fields[4];

  return (
    matchesField(cronMinute, minute, 0, 59) &&
    matchesField(cronHour, hour, 0, 23) &&
    matchesField(cronMonth, month, 1, 12) &&
    (cronDayOfMonth === '*' || cronDayOfWeek === '*' ||
      matchesField(cronDayOfMonth, dayOfMonth, 1, 31) ||
      matchesField(cronDayOfWeek, dayOfWeek, 0, 6))
  );
}

function matchesField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;

  // Handle step values: */5
  if (field.includes('/')) {
    const [base, step] = field.split('/');
    const stepNum = parseInt(step, 10);
    if (isNaN(stepNum) || stepNum === 0) return false;
    if (base === '*') return value % stepNum === 0;
    const baseNum = parseInt(base, 10);
    return value >= baseNum && (value - baseNum) % stepNum === 0;
  }

  // Handle ranges: 1-5
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }

  // Handle lists: 1,3,5
  if (field.includes(',')) {
    return field.split(',').map(Number).includes(value);
  }

  // Single value
  const num = parseInt(field, 10);
  return !isNaN(num) && value === num;
}

export async function handleCron(env: Env, ctx: ExecutionContext): Promise<void> {
  const now = new Date();

  // Get all active tasks with schedules
  const { results } = await env.DB.prepare(
    'SELECT * FROM tasks WHERE status = ? AND schedule IS NOT NULL AND schedule != ?',
  )
    .bind('active', '')
    .all();

  const tasks = results as Task[];

  for (const task of tasks) {
    if (!task.schedule) continue;

    try {
      if (matchesCron(task.schedule, now)) {
        await dispatchTask(env, task.id, 'scheduled', ctx);
      }
    } catch (err) {
      console.error(`Failed to evaluate cron for task ${task.id}:`, err);
    }
  }
}

export async function dispatchTask(
  env: Env,
  taskId: string,
  triggerType: 'manual' | 'scheduled',
  ctx?: ExecutionContext,
): Promise<string> {
  // Generate execution ID
  const executionId = crypto.randomUUID();

  // Create execution record
  await env.DB.prepare(
    'INSERT INTO executions (id, task_id, status, trigger_type, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(executionId, taskId, 'pending', triggerType, new Date().toISOString())
    .run();

  // Get the Durable Object stub for this execution
  const id = env.RUNNER_CONTAINER.idFromName(executionId);
  const stub = env.RUNNER_CONTAINER.get(id);

  // Trigger the container via fetch
  const url = new URL('http://internal/run');
  url.searchParams.set('executionId', executionId);
  url.searchParams.set('taskId', taskId);

  const containerPromise = stub.fetch(new Request(url.toString(), { method: 'POST' }));

  if (ctx) {
    // Use waitUntil to ensure the DO receives the request
    ctx.waitUntil(
      containerPromise.catch((err: any) => {
        console.error(`Container execution failed for ${executionId}:`, err);
      }),
    );
  } else {
    try {
      await containerPromise;
    } catch (err: any) {
      console.error(`Container execution failed for ${executionId}:`, err);
    }
  }

  return executionId;
}
