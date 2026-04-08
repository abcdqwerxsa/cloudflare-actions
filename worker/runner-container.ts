import { Container } from '@cloudflare/containers';
import type { Env, Task, Execution } from './types';

export class RunnerContainer extends Container<Env> {
  override sleepAfter = '5 minutes';
  override envVars = {};

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
    // Fetch task definition from D1
    const task = await this.getTask(taskId);
    if (!task) {
      await this.updateExecution(executionId, { status: 'failed', logs: 'Task not found' });
      return;
    }

    // Update execution status to running
    await this.updateExecution(executionId, {
      status: 'running',
      started_at: new Date().toISOString(),
    });

    try {
      // Build and execute the task command
      const { image, command, envVars } = this.buildTaskConfig(task);

      // Start the container with the task configuration
      await this.start({
        image,
        envVars,
        entrypoint: ['/bin/sh', '-c', command],
      });

      // Wait for completion with a timeout
      const result = await this.waitForCompletion(executionId, task);

      await this.updateExecution(executionId, {
        status: result.exitCode === 0 ? 'success' : 'failed',
        exit_code: result.exitCode,
        completed_at: new Date().toISOString(),
        logs: result.logs,
      });
    } catch (err: any) {
      await this.updateExecution(executionId, {
        status: 'failed',
        exit_code: 1,
        completed_at: new Date().toISOString(),
        logs: err.message,
      });
    }
  }

  private buildTaskConfig(task: Task): {
    image: string;
    command: string;
    envVars: Record<string, string>;
  } {
    // Parse env vars from JSON
    let envVars: Record<string, string> = {};
    try {
      if (task.env_vars) {
        envVars = JSON.parse(task.env_vars);
      }
    } catch {}

    switch (task.type) {
      case 'inline': {
        const image = this.selectRuntimeImage(task.runtime || 'bash');
        const ext = task.runtime === 'python' ? 'py' : task.runtime === 'nodejs' ? 'js' : 'sh';
        const runner = task.runtime === 'python' ? 'python3' : task.runtime === 'nodejs' ? 'node' : '/bin/sh';
        const command = `cat > /tmp/task.${ext} << 'SCRIPT_EOF'\n${task.code}\nSCRIPT_EOF\n${runner} /tmp/task.${ext}`;
        return { image, command, envVars };
      }
      case 'docker': {
        const image = task.docker_image || 'alpine:latest';
        const command = task.command || 'echo "No command specified"';
        return { image, command, envVars };
      }
      case 'git': {
        const branch = task.git_branch || 'main';
        const gitCommand = task.git_command || 'echo "No command specified"';
        const command = [
          'apk add --no-cache git',
          `git clone --branch ${branch} --depth 1 ${task.git_url} /tmp/repo`,
          'cd /tmp/repo',
          gitCommand,
        ].join(' && ');
        return { image: 'alpine/git:latest', command, envVars };
      }
      default:
        return { image: 'alpine:latest', command: 'echo "Unknown task type"', envVars };
    }
  }

  private selectRuntimeImage(runtime: string): string {
    switch (runtime) {
      case 'python':
        return 'python:3.12-slim';
      case 'nodejs':
        return 'node:22-slim';
      case 'bash':
      default:
        return 'alpine:latest';
    }
  }

  private async waitForCompletion(
    executionId: string,
    task: Task,
  ): Promise<{ exitCode: number; logs: string }> {
    // For now, we poll the container and capture output
    // In a real implementation, we'd stream stdout/stderr
    const timeout = 300000; // 5 minute timeout
    const startTime = Date.now();

    // Try to read from the container's stdout
    let logs = '';
    let exitCode = 0;

    try {
      // The container runs the command and we check its state
      // This is a simplified version - in production we'd use proper streaming
      const response = await fetch(`http://localhost:8080/status`);
      if (response.ok) {
        const data = await response.json() as any;
        exitCode = data.exitCode ?? 0;
        logs = data.logs ?? '';
      }
    } catch {
      // Container might still be running
      if (Date.now() - startTime > timeout) {
        await this.updateExecution(executionId, { status: 'timeout' });
        return { exitCode: 124, logs: 'Execution timed out after 5 minutes' };
      }
    }

    return { exitCode, logs };
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
