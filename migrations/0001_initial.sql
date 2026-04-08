-- Drop existing tables if they exist
DROP TABLE IF EXISTS executions;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS tasks;

-- Task definitions
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('inline', 'docker', 'git')),
  status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'active', 'disabled')),
  schedule TEXT,
  runtime TEXT,
  code TEXT DEFAULT '',
  docker_image TEXT,
  command TEXT,
  git_url TEXT,
  git_branch TEXT DEFAULT 'main',
  git_command TEXT,
  env_vars TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Execution records
CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'success', 'failed', 'timeout')),
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('manual', 'scheduled')),
  started_at TEXT,
  completed_at TEXT,
  exit_code INTEGER,
  logs TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API keys for external access
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX idx_executions_task_id ON executions(task_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_created_at ON executions(created_at);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
