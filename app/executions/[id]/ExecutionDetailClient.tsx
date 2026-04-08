'use client';
import { API_BASE } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Execution {
  id: string;
  task_id: string;
  task_name: string;
  task_type: string;
  status: string;
  trigger_type: string;
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  logs: string;
  created_at: string;
}

export default function ExecutionDetailClient() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [execution, setExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadExecution(); }, [id]);

  const loadExecution = async () => {
    try {
      const res = await fetch(`${API_BASE}/executions/${id}`);
      const data = await res.json();
      if (data.execution) setExecution(data.execution);
    } catch (err) { console.error('Failed to load execution:', err); } finally { setLoading(false); }
  };

  const handleRerun = async () => {
    if (!execution) return;
    try {
      const res = await fetch(`${API_BASE}/tasks/${execution.task_id}/trigger`, { method: 'POST' });
      const data = await res.json();
      if (data.executionId) router.push(`/executions/${data.executionId}`);
    } catch {}
  };

  const formatTime = (d: string | null) => d ? new Date(d).toLocaleString() : 'N/A';
  const getDuration = () => {
    if (!execution?.started_at) return 'N/A';
    const start = new Date(execution.started_at);
    const end = execution.completed_at ? new Date(execution.completed_at) : new Date();
    const ms = end.getTime() - start.getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading) return <div className="p-8 max-w-7xl mx-auto flex items-center justify-center h-96"><span className="material-symbols-outlined text-4xl opacity-50 animate-pulse">loading</span></div>;
  if (!execution) return <div className="p-8 max-w-7xl mx-auto text-center"><p className="text-slate-400">Execution not found</p><Link href="/executions" className="text-primary hover:underline text-sm mt-4 block">Back to Executions</Link></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-xs font-mono text-tertiary mb-2 uppercase tracking-widest">
          <Link href="/" className="hover:text-primary transition-colors">Infrastructure</Link><span className="text-slate-600">/</span>
          <Link href="/executions" className="hover:text-primary transition-colors">Executions</Link><span className="text-slate-600">/</span>
          <span className="text-on-surface">{execution.id.slice(0, 8)}</span>
        </nav>
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Execution <span className="text-primary opacity-50 font-mono text-lg">#{execution.id.slice(0, 8)}</span></h1>
          <div className="flex items-center gap-3">
            <Link href={`/tasks/${execution.task_id}`} className="px-4 py-2 text-sm border border-outline-variant/30 text-on-surface hover:bg-surface-container-high rounded-lg transition-all">View Task</Link>
            <button onClick={handleRerun} className="flex items-center gap-2 px-5 py-2 text-sm bg-primary text-on-primary font-bold rounded shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">replay</span>Re-run</button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetaCard label="Status" value={<span className={`flex items-center gap-2 ${execution.status === 'success' ? 'text-primary' : execution.status === 'failed' || execution.status === 'timeout' ? 'text-error' : execution.status === 'running' ? 'text-primary animate-pulse' : 'text-slate-400'}`}><span className="material-symbols-outlined text-sm">{execution.status === 'success' ? 'check_circle' : execution.status === 'failed' ? 'error' : execution.status === 'running' ? 'pending' : execution.status === 'timeout' ? 'timer_off' : 'schedule'}</span>{execution.status.toUpperCase()}</span>} />
        <MetaCard label="Trigger" value={<span className="text-tertiary uppercase text-sm font-bold">{execution.trigger_type}</span>} />
        <MetaCard label="Duration" value={<span className="font-mono text-sm text-on-surface">{getDuration()}</span>} />
        <MetaCard label="Exit Code" value={<span className={`font-mono text-sm font-bold ${execution.exit_code === 0 ? 'text-primary' : execution.exit_code !== null ? 'text-error' : 'text-slate-500'}`}>{execution.exit_code !== null ? execution.exit_code : 'N/A'}</span>} />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
        <MetaCard label="Task" value={<Link href={`/tasks/${execution.task_id}`} className="text-primary hover:underline">{execution.task_name || execution.task_id.slice(0, 8)}</Link>} />
        <MetaCard label="Started" value={<span className="text-slate-300">{formatTime(execution.started_at)}</span>} />
        <MetaCard label="Completed" value={<span className="text-slate-300">{formatTime(execution.completed_at)}</span>} />
      </div>
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col">
        <div className="bg-surface-container-low/80 px-4 py-3 flex justify-between items-center border-b border-outline-variant/10">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Execution Logs</span>
          <button onClick={() => navigator.clipboard.writeText(execution.logs || '')} className="text-[10px] text-slate-500 hover:text-primary transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-sm">content_copy</span>Copy</button>
        </div>
        <div className="p-4 min-h-[400px] max-h-[600px] overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{execution.logs || 'No logs available.'}</div>
      </div>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/10"><p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</p>{value}</div>;
}
