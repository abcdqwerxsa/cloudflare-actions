'use client';
import { API_BASE } from '@/lib/api';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Execution {
  id: string;
  task_id: string;
  task_name: string;
  status: string;
  trigger_type: string;
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  created_at: string;
}

export default function Executions() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadExecutions();
  }, [statusFilter]);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('limit', '100');
      const res = await fetch(`${API_BASE}/executions?${params}`);
      const data = await res.json();
      if (data.executions) setExecutions(data.executions);
    } catch (err) {
      console.error('Failed to load executions:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start) return '-';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 1000) return `${diffMs}ms`;
    if (diffMs < 60000) return `${(diffMs / 1000).toFixed(1)}s`;
    return `${(diffMs / 60000).toFixed(1)}m`;
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline text-on-surface mb-2">Executions</h2>
          <p className="text-slate-400 text-sm">History of automated task runs.</p>
        </div>
        <div className="flex gap-2">
          {['', 'success', 'failed', 'running'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                statusFilter === status
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-surface-container-high text-slate-400 border border-outline-variant/20 hover:text-slate-200'
              }`}
            >
              {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-2xl border border-teal-900/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-high/50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="px-6 py-4">Execution</th>
                <th className="px-6 py-4">Task</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Trigger</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Exit Code</th>
                <th className="px-6 py-4">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-900/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-4 opacity-50 animate-pulse">loading</span>
                    <p>Loading executions...</p>
                  </td>
                </tr>
              ) : executions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <span className="material-symbols-outlined text-4xl mb-4 opacity-50">history</span>
                    <p>No executions found.</p>
                  </td>
                </tr>
              ) : (
                executions.map((exec) => (
                  <tr key={exec.id} className="hover:bg-surface-container-high transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/executions/${exec.id}`} className="text-xs font-mono text-tertiary hover:text-primary transition-colors">
                        {exec.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/tasks/${exec.task_id}`} className="text-sm text-on-surface hover:text-primary transition-colors">
                        {exec.task_name || exec.task_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <ExecStatusBadge status={exec.status} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-400 uppercase">{exec.trigger_type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-slate-300">{formatDuration(exec.started_at, exec.completed_at)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-mono ${exec.exit_code === 0 ? 'text-primary' : exec.exit_code ? 'text-error' : 'text-slate-500'}`}>
                        {exec.exit_code !== null ? exec.exit_code : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-400">{formatTime(exec.started_at)}</span>
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

function ExecStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; icon: string; label: string }> = {
    success: { color: 'text-primary bg-primary/5 border-primary/20', icon: 'check_circle', label: 'Success' },
    failed: { color: 'text-error', icon: 'warning', label: 'Failed' },
    running: { color: 'text-primary bg-primary/5 border-primary/20', icon: 'pending', label: 'Running' },
    pending: { color: 'text-slate-400 bg-slate-400/5 border-slate-400/10', icon: 'schedule', label: 'Pending' },
    timeout: { color: 'text-error', icon: 'timer_off', label: 'Timeout' },
  };
  const config = configs[status] || configs.pending;
  const hasBorder = status === 'success' || status === 'running' || status === 'pending';

  return (
    <div className={`inline-flex items-center gap-2 text-xs font-medium px-2 py-1 ${hasBorder ? 'rounded border' : ''} ${config.color}`}>
      <span className={`material-symbols-outlined text-sm ${status === 'running' ? 'animate-pulse' : ''}`}>{config.icon}</span>
      {config.label}
    </div>
  );
}
