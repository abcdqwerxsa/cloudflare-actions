-- Multi-file task support
-- Add task_files table and simplify tasks table

-- New table for multi-file support
CREATE TABLE task_files (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_entrypoint INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id, file_path)
);
CREATE INDEX idx_task_files_task_id ON task_files(task_id);

-- Recreate tasks table without docker/git/inline specific columns
CREATE TABLE tasks_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('idle', 'active', 'disabled')),
  schedule TEXT,
  entrypoint TEXT DEFAULT 'run.sh',
  env_vars TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Migrate existing tasks
INSERT INTO tasks_new (id, name, description, status, schedule, entrypoint, env_vars, created_at, updated_at)
  SELECT id, name, description, status, schedule, 'run.sh', env_vars, created_at, updated_at
  FROM tasks;

-- Migrate inline task code into task_files
INSERT INTO task_files (id, task_id, file_path, content, is_entrypoint, created_at, updated_at)
  SELECT
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    id,
    'run.sh',
    COALESCE(code, ''),
    1,
    created_at,
    updated_at
  FROM tasks
  WHERE type = 'inline' AND code IS NOT NULL AND code != '';

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;
CREATE INDEX idx_tasks_status ON tasks(status);
