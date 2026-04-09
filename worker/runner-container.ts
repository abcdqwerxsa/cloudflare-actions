import { Container } from '@cloudflare/containers';
import type { Env, Task, TaskFile, Execution } from './types';

export class RunnerContainer extends Container<Env> {
  override sleepAfter = '5m';
  override envVars = {};

  private lastExitCode: number = 0;

  override onStop(params: { exitCode?: number; reason?: string }) {
    this.lastExitCode = params.exitCode ?? 1;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const executionId = url.searchParams.get('executionId');
    const taskId = url.searchParams.get('taskId');

    if (!executionId || !taskId) {
      return new Response(JSON.stringify({ error: 'Missing executionId or taskId' }), { status: 400 });
    }

    try {
      await this.runTask(taskId, executionId);
      return new Response(JSON.stringify({ success: true, executionId }));
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  private async runTask(taskId: string, executionId: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) {
      await this.updateExecution(executionId, { status: 'failed', logs: 'Task not found' });
      return;
    }

    await this.updateExecution(executionId, {
      status: 'running',
      started_at: new Date().toISOString(),
    });

    try {
      const { command, envVars } = await this.buildTaskConfig(taskId, executionId);

      await this.start({
        envVars,
        entrypoint: ['/bin/sh', '-c', command],
      });

      // Wait for container to exit or timeout (5 minutes)
      const timeoutMs = 300000;
      const timeoutPromise = new Promise<{ exitCode: number }>((resolve) => {
        setTimeout(() => {
          resolve({ exitCode: 124 });
        }, timeoutMs);
      });

      const result = await Promise.race([
        this.waitForContainerExit(),
        timeoutPromise,
      ]);

      if (result.exitCode === 124) {
        try { await this.stop(); } catch {}
      }

      // Wait briefly for the container's curl to finish posting logs
      await new Promise(r => setTimeout(r, 2000));

      // Read logs from D1 (posted by container via curl)
      const exec = await this.env.DB.prepare(
        'SELECT logs FROM executions WHERE id = ?'
      ).bind(executionId).first();

      await this.updateExecution(executionId, {
        status: result.exitCode === 0 ? 'success' : (result.exitCode === 124 ? 'timeout' : 'failed'),
        exit_code: result.exitCode,
        completed_at: new Date().toISOString(),
        logs: (exec as any)?.logs || `Process exited with code ${result.exitCode}`,
      });
    } catch (err: any) {
      await this.updateExecution(executionId, {
        status: 'failed',
        exit_code: 1,
        completed_at: new Date().toISOString(),
        logs: err.message,
      });
    } finally {
      try { await this.stop(); } catch {}
    }
  }

  private async waitForContainerExit(): Promise<{ exitCode: number }> {
    try {
      await this.ctx.container.monitor();
    } catch (err: any) {
      // Container errored — still check state below
    }

    const exitCode = this.lastExitCode;

    try {
      const state = this.getState();
      if (state.exitCode !== undefined) {
        return { exitCode: state.exitCode };
      }
    } catch {}

    return { exitCode };
  }

  private async buildTaskConfig(taskId: string, executionId: string): Promise<{
    command: string;
    envVars: Record<string, string>;
  }> {
    const task = await this.getTask(taskId);
    if (!task) throw new Error('Task not found');

    let envVars: Record<string, string> = {};
    try {
      if (task.env_vars) envVars = JSON.parse(task.env_vars);
    } catch {}

    // Add internal vars for log reporting
    envVars.CF_EXECUTION_ID = executionId;
    envVars.CF_API_URL = this.env.WORKER_API_URL || 'https://cloudflare-actions.jeanpaul20020519.workers.dev';

    // Fetch all files for this task
    const { results: files } = await this.env.DB.prepare(
      'SELECT * FROM task_files WHERE task_id = ? ORDER BY file_path'
    ).bind(taskId).all();

    if (!files || files.length === 0) {
      throw new Error('No files found for task');
    }

    const taskFiles = files as TaskFile[];
    const entrypoint = task.entrypoint || 'run.sh';
    const workspace = '/tmp/workspace';

    const scriptParts: string[] = [];
    scriptParts.push(`mkdir -p ${workspace}`);
    scriptParts.push(`cd ${workspace}`);

    // Write each file using heredoc with unique delimiter
    for (const file of taskFiles) {
      const filePath = `${workspace}/${file.file_path}`;
      const lastSlash = filePath.lastIndexOf('/');
      if (lastSlash > 0) {
        const dir = filePath.substring(0, lastSlash);
        scriptParts.push(`mkdir -p '${dir}'`);
      }
      // UUID-based delimiter to avoid collision with file content
      const delimiter = `CF_EOF_${file.id.replace(/-/g, '_')}`;
      scriptParts.push(`cat > '${filePath}' << '${delimiter}'
${file.content}
${delimiter}`);
    }

    // Make entrypoint executable
    scriptParts.push(`chmod +x '${workspace}/${entrypoint}'`);

    // Helper: post current log file to backend
    scriptParts.push(`_post_logs() { cat /tmp/output.log 2>/dev/null | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' | { read j; curl -sf -X PUT "$CF_API_URL/executions/$CF_EXECUTION_ID/logs" -H "Content-Type: application/json" -d "$(printf '{"logs":%s}' "$j")"; } || true; }`);

    // Run entrypoint with output tee'd to log file
    scriptParts.push(`/bin/bash '${workspace}/${entrypoint}' > /tmp/output.log 2>&1 &`);
    scriptParts.push(`CMD_PID=$!`);

    // Background: stream logs every 2 seconds while command runs
    scriptParts.push(`(while kill -0 $CMD_PID 2>/dev/null; do sleep 2; _post_logs; done; sleep 1; _post_logs) &`);

    // Wait for command to finish
    scriptParts.push(`wait $CMD_PID`);
    scriptParts.push(`exit_code=$?`);
    scriptParts.push(`wait`);
    scriptParts.push(`exit $exit_code`);

    const command = scriptParts.join('\n');
    return { command, envVars };
  }

  private async getTask(taskId: string): Promise<Task | null> {
    const result = await this.env.DB.prepare('SELECT * FROM tasks WHERE id = ?')
      .bind(taskId)
      .first();
    return result as Task | null;
  }

  private async updateExecution(
    executionId: string,
    updates: Partial<Pick<Execution, 'status' | 'started_at' | 'completed_at' | 'exit_code' | 'logs'>>,
  ): Promise<void> {
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      setClauses.push('status = ?');
      values.push(updates.status);
    }
    if (updates.started_at !== undefined) {
      setClauses.push('started_at = ?');
      values.push(updates.started_at);
    }
    if (updates.completed_at !== undefined) {
      setClauses.push('completed_at = ?');
      values.push(updates.completed_at);
    }
    if (updates.exit_code !== undefined) {
      setClauses.push('exit_code = ?');
      values.push(updates.exit_code);
    }
    if (updates.logs !== undefined) {
      setClauses.push('logs = ?');
      values.push(updates.logs);
    }

    if (setClauses.length === 0) return;

    values.push(executionId);
    await this.env.DB.prepare(
      `UPDATE executions SET ${setClauses.join(', ')} WHERE id = ?`,
    )
      .bind(...values)
      .run();
  }
}
