// Task status and execution types
export type TaskStatus = 'idle' | 'active' | 'disabled';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'timeout';
export type TriggerType = 'manual' | 'scheduled';

export interface TaskFile {
  id: string;
  task_id: string;
  file_path: string;
  content: string;
  is_entrypoint: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  schedule: string | null;
  entrypoint: string;
  env_vars: string; // JSON string
  created_at: string;
  updated_at: string;
  // Joined field (populated by API, not in DB)
  files?: TaskFile[];
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
  // Joined fields
  task_name?: string;
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
  ASSETS: Fetcher;
  API_KEY: string;
  AUTH_PASSWORD: string;
  AUTH_SECRET: string;
  WORKER_API_URL: string;
}

export interface TaskFileInput {
  file_path: string;
  content: string;
  is_entrypoint?: boolean;
}

export interface CreateTaskInput {
  name: string;
  description?: string;
  schedule?: string;
  entrypoint?: string;
  env_vars?: Record<string, string>;
  files: TaskFileInput[];
}

export interface UpdateTaskInput {
  name?: string;
  description?: string;
  status?: TaskStatus;
  schedule?: string | null;
  entrypoint?: string;
  env_vars?: Record<string, string> | string;
  files?: TaskFileInput[];
}
