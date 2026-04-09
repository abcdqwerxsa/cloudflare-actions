'use client';
import { API_BASE } from '@/lib/api';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
    toml: 'settings',
    cfg: 'settings', ini: 'settings',
    env: 'lock',
  };
  return icons[ext] || 'draft';
}

export default function CreateTask() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [envVarsText, setEnvVarsText] = useState('{}');
  const [files, setFiles] = useState<FileEntry[]>([
    {
      id: crypto.randomUUID(),
      file_path: 'run.sh',
      content: '#!/bin/bash\n# Install dependencies\n# pip install -r requirements.txt\n# npm install\n\n# Run your task\necho "Hello from Cloudflare Actions!"\n',
      is_entrypoint: true,
    }
  ]);
  const [activeFileId, setActiveFileId] = useState(files[0].id);
  const [showAddFile, setShowAddFile] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');

  const activeFile = files.find(f => f.id === activeFileId);

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
    if (!file) return;
    if (file.is_entrypoint && files.length > 1) return; // Can't delete entrypoint
    const remaining = files.filter(f => f.id !== id);
    setFiles(remaining);
    if (activeFileId === id) {
      setActiveFileId(remaining[0]?.id || '');
    }
  };

  const setEntrypoint = (id: string) => {
    setFiles(prev => prev.map(f => ({ ...f, is_entrypoint: f.id === id })));
  };

  const handleSave = async () => {
    if (!name.trim() || files.length === 0) return;
    setSaving(true);
    try {
      const body = {
        name,
        description,
        schedule: schedule || null,
        entrypoint: files.find(f => f.is_entrypoint)?.file_path || 'run.sh',
        env_vars: JSON.parse(envVarsText || '{}'),
        files: files.map(f => ({
          file_path: f.file_path,
          content: f.content,
          is_entrypoint: f.is_entrypoint,
        })),
      };
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.task) {
        router.push(`/task?id=${data.task.id}`);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSaving(false);
    }
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

        {/* Right Panel - File Tree + Editor */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col relative" style={{ minHeight: '500px' }}>
            <div className="bg-surface-container-low/80 backdrop-blur px-4 py-3 flex justify-between items-center border-b border-outline-variant/10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-xs font-mono font-medium text-slate-300">
                    {activeFile?.file_path || 'No file selected'}
                  </span>
                </div>
                <div className="h-4 w-px bg-outline-variant/20"></div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">UTF-8</span>
              </div>
            </div>
            <div className="flex-1 flex">
              {/* File tree sidebar */}
              <div className="w-48 bg-surface-container-low/30 border-r border-outline-variant/10 flex flex-col">
                <div className="p-2 border-b border-outline-variant/10">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest px-2 py-1">Files</div>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {files.map(file => (
                    <div
                      key={file.id}
                      className={`group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-xs transition-colors ${
                        activeFileId === file.id ? 'bg-primary/10 text-primary' : 'text-slate-300 hover:bg-surface-container-high'
                      }`}
                      onClick={() => setActiveFileId(file.id)}
                    >
                      <span className="material-symbols-outlined text-sm">{getFileIcon(file.file_path)}</span>
                      {file.is_entrypoint && <span className="material-symbols-outlined text-[10px] text-primary">play_arrow</span>}
                      <span className="flex-1 truncate font-mono">{file.file_path}</span>
                      {!file.is_entrypoint && files.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteFile(file.id); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-error transition-all"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t border-outline-variant/10">
                  {showAddFile ? (
                    <div className="flex gap-1">
                      <input
                        className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded px-2 py-1 text-xs font-mono text-on-surface outline-none"
                        type="text"
                        value={newFilePath}
                        onChange={(e) => setNewFilePath(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addFile(); if (e.key === 'Escape') setShowAddFile(false); }}
                        placeholder="path/to/file.py"
                        autoFocus
                      />
                      <button onClick={addFile} className="text-primary text-xs p-1">
                        <span className="material-symbols-outlined text-sm">check</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddFile(true)}
                      className="flex items-center gap-1 w-full text-xs text-slate-400 hover:text-primary transition-colors px-2 py-1"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add File
                    </button>
                  )}
                </div>
              </div>
              {/* Code editor */}
              <div className="flex-1 relative flex">
                {activeFile && (
                  <>
                    <div className="w-12 bg-surface-container-low/30 border-r border-outline-variant/5 text-right pr-3 pt-4 text-slate-600 select-none text-[11px] font-mono leading-relaxed">
                      {activeFile.content.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                    </div>
                    <textarea
                      value={activeFile.content}
                      onChange={(e) => updateFile(activeFile.id, { content: e.target.value })}
                      className="flex-1 bg-transparent text-on-surface font-mono text-sm leading-relaxed p-4 outline-none resize-none whitespace-pre"
                      spellCheck={false}
                    />
                  </>
                )}
              </div>
            </div>
            {/* Context menu bar */}
            {activeFile && !activeFile.is_entrypoint && (
              <div className="px-4 py-2 border-t border-outline-variant/10 flex items-center gap-2">
                <button
                  onClick={() => setEntrypoint(activeFile.id)}
                  className="text-[10px] text-slate-400 hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">play_arrow</span>
                  Set as entrypoint
                </button>
              </div>
            )}
          </div>

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
