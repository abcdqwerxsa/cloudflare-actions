// Task types
export type TaskType = 'inline' | 'docker' | 'git';
export type TaskStatus = 'idle' | 'active' | 'disabled';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout';
export type TriggerType = 'manual' | 'scheduled';
export type Runtime = 'python' | 'nodejs' | 'bash';

export interface Task {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  schedule: string | null;
  runtime: Runtime | null;
  code: string;
  docker_image: string | null;
  command: string | null;
  git_url: string | null;
  git_branch: string;
  git_command: string | null;
  env_vars: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface Execution {
  id: string;
  task_id: string;
  status: ExecutionStatus;
  trigger_type: TriggerType;
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  logs: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export interface Env {
  DB: D1Database;
  RUNNER_CONTAINER: DurableObjectNamespace;
  API_KEY: string;
}

export interface CreateTaskInput {
  name: string;
  description?: string;
  type: TaskType;
  schedule?: string;
  runtime?: Runtime;
  code?: string;
  docker_image?: string;
  command?: string;
  git_url?: string;
  git_branch?: string;
  git_command?: string;
  env_vars?: Record<string, string>;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?: TaskStatus;
}
