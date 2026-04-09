'use client';
import { API_BASE } from '@/lib/api';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  name: string;
  status: string;
  schedule: string | null;
  entrypoint: string;
  updated_at: string;
}

export default function Tasks() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      const data = await res.json();
      if (data.tasks) setTasks(data.tasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async (taskId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/trigger`, { method: 'POST' });
      const data = await res.json();
      if (data.executionId) {
        router.push(`/execution?id=${data.executionId}`);
      }
    } catch (err) {
      console.error('Failed to trigger task:', err);
    }
  };

  const handleDelete = async (taskId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
      await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const formatLastRun = (dateStr: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  };

  const activeCount = tasks.filter((t) => t.status === 'active').length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline text-on-surface mb-2">Tasks</h2>
          <p className="text-slate-400 text-sm">
            {loading ? 'Loading...' : <>Orchestrating <span className="text-primary">{activeCount} active</span> automated instances across the cluster.</>}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/tasks/new" className="flex items-center gap-2 px-5 py-2 text-sm bg-primary text-on-primary font-bold rounded shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
            <span className="material-symbols-outlined text-lg">add</span>
            Create New Task
          </Link>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-2xl border border-teal-900/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="px-6 py-4">Task Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Schedule</th>
                <th className="px-6 py-4">Last Updated</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-900/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-4 opacity-50 animate-pulse">loading</span>
                    <p>Loading tasks...</p>
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-4 opacity-50">terminal</span>
                    <p>No tasks yet. Create your first task to get started.</p>
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-surface-container-high transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-8 rounded-full ${task.status === 'active' ? 'bg-primary' : task.status === 'disabled' ? 'bg-slate-700' : 'bg-primary/40'}`}></div>
                        <div>
                          <Link href={`/task?id=${task.id}`} className="text-sm font-bold text-on-surface leading-none hover:text-primary transition-colors">{task.name}</Link>
                          <p className="text-[10px] text-slate-500 mt-1">{task.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-6 py-5">
                      <code className="text-xs font-mono text-tertiary bg-surface-container-lowest px-2 py-1 rounded">
                        {task.schedule || 'Manual'}
                      </code>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-xs text-slate-400">{formatLastRun(task.updated_at)}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleRun(task.id, e)} className="p-2 text-slate-400 hover:text-primary transition-colors" title="Run Now">
                          <span className="material-symbols-outlined text-xl">play_arrow</span>
                        </button>
                        <Link href={`/task?id=${task.id}`} className="p-2 text-slate-400 hover:text-tertiary transition-colors" title="Edit">
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </Link>
                        <button onClick={(e) => handleDelete(task.id, e)} className="p-2 text-slate-400 hover:text-error transition-colors" title="Delete">
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/5 px-2 py-1 rounded border border-primary/20">
        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(60,221,199,0.7)] animate-pulse"></div>
        Active
      </div>
    );
  }
  if (status === 'disabled') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-medium text-error px-2 py-1">
        <span className="material-symbols-outlined text-sm">warning</span>
        Disabled
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-400/5 px-2 py-1 rounded border border-slate-400/10">
      <span className="material-symbols-outlined text-sm">pause_circle</span>
      Idle
    </div>
  );
}
