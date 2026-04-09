'use client';
import { API_BASE } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface TaskFile {
  id: string;
  file_path: string;
  content: string;
  is_entrypoint: number;
}

interface Task {
  id: string;
  name: string;
  description: string;
  status: string;
  schedule: string | null;
  entrypoint: string;
  env_vars: string;
  files?: TaskFile[];
}

interface Execution {
  id: string;
  status: string;
  trigger_type: string;
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  created_at: string;
}

interface FileEntry {
  id: string;
  file_path: string;
  content: string;
  is_entrypoint: boolean;
}

function getFileIcon(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    sh: 'terminal', bash: 'terminal',
    py: 'code', pyw: 'code',
    js: 'javascript', ts: 'code',
    json: 'data_object',
    txt: 'description', md: 'description',
    yml: 'settings', yaml: 'settings',
  };
  return icons[ext] || 'draft';
}

export default function TaskDetailClient() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('id') || '';
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [schedule, setSchedule] = useState('');
  const [envVarsText, setEnvVarsText] = useState('{}');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFileId, setActiveFileId] = useState('');
  const [showAddFile, setShowAddFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  useEffect(() => { if (taskId) loadTask(); else setLoading(false); }, [taskId]);

  const loadTask = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`);
      const data = await res.json();
      if (data.task) {
        setTask(data.task);
        setSchedule(data.task.schedule || '');
        setEnvVarsText(data.task.env_vars || '{}');
        if (data.task.files && data.task.files.length > 0) {
          const fileEntries: FileEntry[] = data.task.files.map((f: TaskFile) => ({
            id: f.id || crypto.randomUUID(),
            file_path: f.file_path,
            content: f.content,
            is_entrypoint: f.is_entrypoint === 1,
          }));
          setFiles(fileEntries);
          setActiveFileId(fileEntries[0]?.id || '');
        } else {
          const defaultFile: FileEntry = {
            id: crypto.randomUUID(),
            file_path: 'run.sh',
            content: '#!/bin/bash\necho "Hello from Cloudflare Actions!"\n',
            is_entrypoint: true,
          };
          setFiles([defaultFile]);
          setActiveFileId(defaultFile.id);
        }
      }
      loadExecutions();
    } catch (err) {
      console.error('Failed to load task:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutions = async () => {
    try {
      const res = await fetch(`${API_BASE}/executions?task_id=${taskId}&limit=5`);
      const data = await res.json();
      if (data.executions) setExecutions(data.executions);
    } catch {}
  };

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Dispatching execution...\n');
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/trigger`, { method: 'POST' });
      const data = await res.json();
      if (data.executionId) {
        setOutput(`Execution dispatched: ${data.executionId}\nWaiting for results...\n`);
        pollExecution(data.executionId);
      } else {
        setOutput(`Error: ${data.error || 'Failed to trigger'}`);
        setIsRunning(false);
      }
    } catch (err: any) {
      setOutput(`Failed: ${err.message}`);
      setIsRunning(false);
    }
  };

  const pollExecution = async (executionId: string) => {
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`${API_BASE}/executions/${executionId}`);
        const data = await res.json();
        if (data.execution) {
          const exec = data.execution;
          if (exec.status === 'success' || exec.status === 'failed' || exec.status === 'timeout') {
            setOutput(exec.logs || `Execution ${exec.status} with exit code ${exec.exit_code}`);
            setIsRunning(false);
            loadExecutions();
            return;
          }
          if (exec.logs) setOutput(exec.logs);
        }
      } catch {}
    }
    setOutput('Polling timed out.');
    setIsRunning(false);
  };

  const handleSave = async () => {
    if (!task) return;
    setSaving(true);
    try {
      const entrypoint = files.find(f => f.is_entrypoint)?.file_path || 'run.sh';
      const body = {
        name: task.name,
        schedule: schedule || null,
        entrypoint,
        env_vars: envVarsText,
        files: files.map(f => ({
          file_path: f.file_path,
          content: f.content,
          is_entrypoint: f.is_entrypoint,
        })),
      };
      await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      loadTask();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    try { await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' }); router.push('/tasks'); } catch {}
  };

  const updateFile = (id: string, updates: Partial<FileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const addFile = () => {
    if (!newFilePath.trim()) return;
    const path = newFilePath.trim().replace(/^\//, '');
    if (files.some(f => f.file_path === path)) return;
    const newFile: FileEntry = {
      id: crypto.randomUUID(),
      file_path: path,
      content: '',
      is_entrypoint: false,
    };
    setFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setNewFilePath('');
    setShowAddFile(false);
  };

  const deleteFile = (id: string) => {
    const file = files.find(f => f.id === id);
    if (!file || file.is_entrypoint) return;
    const remaining = files.filter(f => f.id !== id);
    setFiles(remaining);
    if (activeFileId === id) setActiveFileId(remaining[0]?.id || '');
  };

  const setEntrypoint = (id: string) => {
    setFiles(prev => prev.map(f => ({ ...f, is_entrypoint: f.id === id })));
  };

  const activeFile = files.find(f => f.id === activeFileId);

  if (loading) return <div className="p-8 max-w-7xl mx-auto flex items-center justify-center h-96"><div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div><span className="ml-3 text-slate-400 text-sm">Loading task...</span></div>;
  if (!task) return <div className="p-8 max-w-7xl mx-auto text-center"><p className="text-slate-400">Task not found</p><Link href="/tasks" className="text-primary hover:underline text-sm mt-4 block">Back to Tasks</Link></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-xs font-mono text-tertiary mb-2 uppercase tracking-widest">
          <Link href="/" className="hover:text-primary transition-colors">Infrastructure</Link><span className="text-slate-600">/</span>
          <Link href="/tasks" className="hover:text-primary transition-colors">Tasks</Link><span className="text-slate-600">/</span>
          <span className="text-on-surface">{task.name}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-headline font-bold text-on-surface tracking-tight">{task.name} <span className="text-primary opacity-50 font-mono text-lg">#{task.id.slice(0, 8)}</span></h1>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded border ${task.status === 'active' ? 'text-primary bg-primary/10 border-primary/20' : 'text-slate-400 bg-slate-400/10 border-slate-400/10'}`}>{task.status.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
            <h2 className="text-sm font-headline font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2"><span className="material-symbols-outlined text-lg">schedule</span>Schedule</h2>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Cron Expression</label><div className="relative"><input className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg pl-4 pr-10 py-2.5 text-sm font-mono text-tertiary focus:ring-1 focus:ring-primary focus:border-primary outline-none" type="text" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="0 0 * * *" /><span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">help</span></div></div>
              <div className="grid grid-cols-4 gap-1.5">{[{label:'Daily',cron:'0 0 * * *'},{label:'Weekly',cron:'0 0 * * 0'},{label:'Monthly',cron:'0 0 1 * *'},{label:'Hourly',cron:'0 * * * *'}].map((p) => (<button key={p.label} onClick={() => setSchedule(p.cron)} className={`${schedule === p.cron ? 'bg-surface-container-highest border-primary/20 text-primary' : 'bg-surface-container-low border-outline-variant/10 text-slate-400 hover:bg-surface-container-high'} text-[10px] p-2 rounded border transition-colors`}>{p.label}</button>))}</div>
            </div>
          </section>
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
            <h2 className="text-sm font-headline font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2"><span className="material-symbols-outlined text-lg">history</span>Recent Executions</h2>
            <div className="space-y-3">{executions.length === 0 ? <p className="text-xs text-slate-500 text-center py-4">No executions yet</p> : executions.map((exec) => (<Link key={exec.id} href={`/execution?id=${exec.id}`} className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/5 hover:border-primary/20 transition-colors"><div className="flex items-center gap-3"><div className={`w-1.5 h-1.5 rounded-full ${exec.status === 'success' ? 'bg-primary' : exec.status === 'failed' ? 'bg-error' : exec.status === 'running' ? 'bg-primary animate-pulse' : 'bg-slate-600'}`} /><span className="text-xs font-mono text-slate-300">{exec.id.slice(0, 8)}</span></div><div className="flex items-center gap-2"><span className="text-[10px] text-slate-500 uppercase">{exec.trigger_type}</span><span className={`text-[10px] font-bold ${exec.status === 'success' ? 'text-primary' : exec.status === 'failed' ? 'text-error' : 'text-slate-400'}`}>{exec.status.toUpperCase()}</span></div></Link>))}</div>
          </section>
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
            <h2 className="text-sm font-headline font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2"><span className="material-symbols-outlined text-lg">key</span>Environment Variables</h2>
            <textarea className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono text-tertiary focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none resize-none" rows={4} value={envVarsText} onChange={(e) => setEnvVarsText(e.target.value)} placeholder='{"KEY": "value"}' />
          </section>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col relative" style={{ minHeight: '400px' }}>
            <div className="bg-surface-container-low/80 backdrop-blur px-4 py-3 flex justify-between items-center border-b border-outline-variant/10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-xs font-mono font-medium text-slate-300">{activeFile?.file_path || 'No file'}</span>
                </div>
                <div className="h-4 w-px bg-outline-variant/20"></div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">UTF-8</span>
              </div>
              <button onClick={handleRun} disabled={isRunning} className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs font-bold transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-sm">play_arrow</span>{isRunning ? 'RUNNING...' : 'RUN'}
              </button>
            </div>
            <div className="flex-1 flex">
              <div className="w-48 bg-surface-container-low/30 border-r border-outline-variant/10 flex flex-col">
                <div className="p-2 border-b border-outline-variant/10">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-2 py-1">Files</div>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {files.map(file => (
                    <div key={file.id} className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs transition-colors ${activeFileId === file.id ? 'bg-primary/10 text-primary' : 'text-slate-300 hover:bg-surface-container-high'}`} onClick={() => setActiveFileId(file.id)}>
                      <span className="material-symbols-outlined text-sm">{getFileIcon(file.file_path)}</span>
                      {file.is_entrypoint && <span className="material-symbols-outlined text-[10px] text-primary">play_arrow</span>}
                      <span className="flex-1 truncate font-mono">{file.file_path}</span>
                      {!file.is_entrypoint && files.length > 1 && (
                        <button onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-error transition-all">
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-outline-variant/10">
                  {showAddFile ? (
                    <div className="flex gap-1">
                      <input className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded px-2 py-1 text-xs font-mono text-on-surface outline-none" type="text" value={newFilePath} onChange={(e) => setNewFilePath(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addFile(); if (e.key === 'Escape') setShowAddFile(false); }} placeholder="path/file.py" autoFocus />
                      <button onClick={addFile} className="text-primary text-xs p-1"><span className="material-symbols-outlined text-sm">check</span></button>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddFile(true)} className="flex items-center gap-1 w-full text-xs text-slate-400 hover:text-primary transition-colors px-2 py-1">
                      <span className="material-symbols-outlined text-sm">add</span>Add File
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 relative flex">
                {activeFile && (
                  <>
                    <div className="w-12 bg-surface-container-low/30 border-r border-outline-variant/5 text-right pr-3 pt-4 text-slate-600 select-none text-[11px] font-mono leading-relaxed">
                      {activeFile.content.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                    </div>
                    <textarea value={activeFile.content} onChange={(e) => updateFile(activeFile.id, { content: e.target.value })} className="flex-1 bg-transparent text-on-surface font-mono text-sm leading-relaxed p-4 outline-none resize-none whitespace-pre" spellCheck={false} />
                  </>
                )}
              </div>
            </div>
            {activeFile && !activeFile.is_entrypoint && (
              <div className="px-4 py-2 border-t border-outline-variant/10">
                <button onClick={() => setEntrypoint(activeFile.id)} className="text-[10px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">play_arrow</span>Set as entrypoint
                </button>
              </div>
            )}
          </div>

          <div className="h-48 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col">
            <div className="bg-surface-container-low/80 px-4 py-2 flex items-center border-b border-outline-variant/10"><span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Execution Output</span></div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap">{output || 'Ready to execute...'}</div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 text-error hover:bg-error/10 rounded-lg transition-all text-xs font-bold font-headline"><span className="material-symbols-outlined text-lg">delete</span>DELETE TASK</button>
            <div className="flex items-center gap-4">
              <Link href="/tasks" className="px-6 py-2.5 text-on-surface border border-outline-variant/30 hover:bg-surface-container-high rounded-lg transition-all text-xs font-bold font-headline tracking-widest">CANCEL</Link>
              <button onClick={handleSave} disabled={saving} className="px-8 py-2.5 bg-primary text-on-primary hover:opacity-90 rounded-lg transition-all text-xs font-bold font-headline tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-lg">save</span>{saving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
