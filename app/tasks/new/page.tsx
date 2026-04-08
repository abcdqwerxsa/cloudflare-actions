'use client';
import { API_BASE } from '@/lib/api';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type TaskType = 'inline' | 'docker' | 'git';
type Runtime = 'python' | 'nodejs' | 'bash';

export default function CreateTask() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>('inline');
  const [runtime, setRuntime] = useState<Runtime>('python');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [code, setCode] = useState('# Write your task code here\nprint("Hello from Cloudflare Actions!")\n');
  const [dockerImage, setDockerImage] = useState('');
  const [command, setCommand] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitCommand, setGitCommand] = useState('');
  const [envVarsText, setEnvVarsText] = useState('{}');

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body: any = {
        name,
        description,
        type: taskType,
        schedule: schedule || null,
        env_vars: JSON.parse(envVarsText || '{}'),
      };

      if (taskType === 'inline') {
        body.runtime = runtime;
        body.code = code;
      } else if (taskType === 'docker') {
        body.docker_image = dockerImage;
        body.command = command;
      } else if (taskType === 'git') {
        body.git_url = gitUrl;
        body.git_branch = gitBranch;
        body.git_command = gitCommand;
      }

      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.task) {
        router.push(`/tasks/${data.task.id}`);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSaving(false);
    }
  };

  const defaultCode: Record<Runtime, string> = {
    python: '# Write your Python code here\nprint("Hello from Cloudflare Actions!")\n',
    nodejs: '// Write your Node.js code here\nconsole.log("Hello from Cloudflare Actions!");\n',
    bash: '#!/bin/bash\n# Write your bash code here\necho "Hello from Cloudflare Actions!"\n',
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-xs font-mono text-tertiary mb-2 uppercase tracking-widest">
          <Link href="/" className="hover:text-primary transition-colors">Infrastructure</Link>
          <span className="text-slate-600">/</span>
          <Link href="/tasks" className="hover:text-primary transition-colors">Tasks</Link>
          <span className="text-slate-600">/</span>
          <span className="text-on-surface">New Task</span>
        </nav>
        <h1 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Create Task</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Panel - Configuration */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
            <h2 className="text-sm font-headline font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">info</span>
              Task Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Task Name</label>
                <input
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. database-optimizer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Description</label>
                <textarea
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none resize-none"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this task"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Task Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['inline', 'docker', 'git'] as TaskType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTaskType(t)}
                      className={`${taskType === t ? 'bg-primary text-on-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' : 'bg-surface-container-high text-on-surface border border-outline-variant/20 hover:bg-surface-container-highest'} py-2 px-3 rounded text-xs font-bold transition-all capitalize`}
                    >
                      {t === 'inline' ? 'Inline Code' : t === 'docker' ? 'Docker' : 'Git Repo'}
                    </button>
                  ))}
                </div>
              </div>
              {taskType === 'inline' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Runtime</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['python', 'nodejs', 'bash'] as Runtime[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => { setRuntime(r); setCode(defaultCode[r]); }}
                        className={`${runtime === r ? 'bg-primary text-on-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' : 'bg-surface-container-high text-on-surface border border-outline-variant/20 hover:bg-surface-container-highest'} py-2 px-3 rounded text-xs font-bold transition-all`}
                      >
                        {r === 'nodejs' ? 'Node.js' : r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
            <h2 className="text-sm font-headline font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">schedule</span>
              Schedule
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Cron Expression</label>
                <div className="relative">
                  <input
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg pl-4 pr-10 py-2.5 text-sm font-mono text-tertiary focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                    type="text"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="0 0 * * * (leave empty for manual only)"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">help</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Daily', cron: '0 0 * * *' },
                  { label: 'Weekly', cron: '0 0 * * 0' },
                  { label: 'Monthly', cron: '0 0 1 * *' },
                  { label: 'Hourly', cron: '0 * * * *' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setSchedule(preset.cron)}
                    className={`${schedule === preset.cron ? 'bg-surface-container-highest border-primary/20 text-primary' : 'bg-surface-container-low border-outline-variant/10 text-slate-400 hover:bg-surface-container-high'} text-[10px] p-2 rounded border transition-colors`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
            <h2 className="text-sm font-headline font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">key</span>
              Environment Variables
            </h2>
            <textarea
              className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono text-tertiary focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none resize-none"
              rows={4}
              value={envVarsText}
              onChange={(e) => setEnvVarsText(e.target.value)}
              placeholder='{"KEY": "value"}'
            />
          </section>
        </div>

        {/* Right Panel - Task Content */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {taskType === 'inline' && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col relative" style={{ minHeight: '500px' }}>
              <div className="bg-surface-container-low/80 backdrop-blur px-4 py-3 flex justify-between items-center border-b border-outline-variant/10">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    <span className="text-xs font-mono font-medium text-slate-300">
                      task.{runtime === 'python' ? 'py' : runtime === 'nodejs' ? 'js' : 'sh'}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-outline-variant/20"></div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">UTF-8</span>
                </div>
              </div>
              <div className="flex-1 relative flex">
                <div className="w-12 bg-surface-container-low/30 border-r border-outline-variant/5 text-right pr-3 pt-4 text-slate-600 select-none text-[11px] font-mono leading-relaxed">
                  {code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 bg-transparent text-on-surface font-mono text-sm leading-relaxed p-4 outline-none resize-none whitespace-pre"
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          {taskType === 'docker' && (
            <div className="space-y-4">
              <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Docker Image</label>
                <input
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none"
                  type="text"
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  placeholder="e.g. node:22-slim"
                />
              </section>
              <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Command</label>
                <textarea
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none resize-none"
                  rows={6}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="e.g. npm install && npm start"
                />
              </section>
            </div>
          )}

          {taskType === 'git' && (
            <div className="space-y-4">
              <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Repository URL</label>
                <input
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none"
                  type="text"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                />
              </section>
              <div className="grid grid-cols-2 gap-4">
                <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Branch</label>
                  <input
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none"
                    type="text"
                    value={gitBranch}
                    onChange={(e) => setGitBranch(e.target.value)}
                    placeholder="main"
                  />
                </section>
                <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Command</label>
                  <input
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none"
                    type="text"
                    value={gitCommand}
                    onChange={(e) => setGitCommand(e.target.value)}
                    placeholder="npm install && npm test"
                  />
                </section>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/tasks')}
              className="flex items-center gap-2 px-4 py-2 text-error hover:bg-error/10 rounded-lg transition-all text-xs font-bold font-headline"
            >
              <span className="material-symbols-outlined text-lg">close</span>
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-8 py-2.5 bg-primary text-on-primary hover:opacity-90 rounded-lg transition-all text-xs font-bold font-headline tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              {saving ? 'CREATING...' : 'CREATE TASK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
