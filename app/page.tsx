'use client';
import { API_BASE } from '@/lib/api';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Task { id: string; name: string; status: string; }
interface Execution {
  id: string;
  task_id: string;
  task_name: string;
  status: string;
  trigger_type: string;
  created_at: string;
  started_at: string | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, successRate: '0%', failed: 0, active: 0 });
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [chartData, setChartData] = useState<number[]>(Array(24).fill(0));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksRes, execsRes] = await Promise.all([
        fetch(`${API_BASE}/tasks`),
        fetch(`${API_BASE}/executions?limit=20`),
      ]);
      const tasksData = await tasksRes.json();
      const execsData = await execsRes.json();

      const tasks: Task[] = tasksData.tasks || [];
      const execs: Execution[] = execsData.executions || [];

      // Calculate stats
      const total = tasks.length;
      const active = tasks.filter((t) => t.status === 'active').length;
      const successCount = execs.filter((e) => e.status === 'success').length;
      const failedCount = execs.filter((e) => e.status === 'failed' || e.status === 'timeout').length;
      const totalFinished = successCount + failedCount;
      const successRate = totalFinished > 0 ? ((successCount / totalFinished) * 100).toFixed(1) + '%' : '0%';

      setStats({ total, successRate, failed: failedCount, active: execs.filter((e) => e.status === 'running').length });

      // Recent activity
      setExecutions(execs.slice(0, 10));

      // Chart data - executions per hour for last 24h
      const now = new Date();
      const hourly = Array(24).fill(0);
      execs.forEach((exec) => {
        const date = new Date(exec.created_at);
        const hoursAgo = Math.floor((now.getTime() - date.getTime()) / 3600000);
        if (hoursAgo >= 0 && hoursAgo < 24) {
          hourly[23 - hoursAgo]++;
        }
      });
      setChartData(hourly);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const maxChart = Math.max(...chartData, 1);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface tracking-tight">Infrastructure Overview</h1>
          <p className="text-tertiary text-sm mt-1">Live precision monitoring for production automation cluster.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/tasks/new" className="px-4 py-2 bg-gradient-to-tr from-primary-container to-primary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/10 hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">add</span>
            New Task
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard title="Total Tasks" value={loading ? '...' : stats.total.toString()} icon="format_list_bulleted" trend="Registered tasks" color="tertiary" />
        <MetricCard title="Success Rate" value={loading ? '...' : stats.successRate} icon="check_circle" trend="Recent executions" color="primary" />
        <MetricCard title="Failed Runs" value={loading ? '...' : stats.failed.toString()} icon="error_outline" trend={stats.failed > 0 ? 'Requires attention' : 'All clear'} color="error" />
        <MetricCard title="Active Executions" value={loading ? '...' : stats.active.toString()} icon="data_exploration" trend="Currently computing" color="primary" pulse />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-surface-container-low rounded-xl p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-headline text-lg font-bold">Execution Volume</h3>
              <p className="text-slate-500 text-xs uppercase tracking-widest">Last 24 hours</p>
            </div>
            <span className="inline-flex items-center px-2 py-1 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">LIVE</span>
          </div>
          <div className="h-64 flex items-end gap-1.5 w-full pt-4">
            {chartData.map((count, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t transition-all cursor-pointer hover:bg-primary/50 ${count > 0 ? 'bg-surface-container-high/60' : 'bg-surface-container-high/20'}`}
                style={{ height: `${Math.max(4, (count / maxChart) * 100)}%` }}
                title={`${count} executions`}
              >
                {count > 0 && (
                  <div className="text-[9px] text-center text-slate-500 -mt-5">{count}</div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-tighter text-slate-500 mt-4 border-t border-teal-900/10 pt-4">
            <span>24h ago</span><span>18h</span><span>12h</span><span>6h</span><span>Now</span>
          </div>
        </div>

        <div className="lg:col-span-4 bg-surface-container-low rounded-xl flex flex-col">
          <div className="p-6 border-b border-teal-900/10">
            <h3 className="font-headline text-lg font-bold">Recent Activity</h3>
            <p className="text-slate-500 text-xs uppercase tracking-widest">Global Event Stream</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px] p-6 space-y-6">
            {loading ? (
              <p className="text-slate-500 text-sm text-center">Loading...</p>
            ) : executions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center">No recent activity</p>
            ) : (
              executions.map((exec) => (
                <Link key={exec.id} href={`/executions/${exec.id}`} className="block">
                  <ActivityItem
                    id={exec.id.slice(0, 8)}
                    name={exec.task_name || exec.task_id.slice(0, 8)}
                    status={exec.status === 'success' ? 'success' : exec.status === 'failed' ? 'error' : exec.status === 'running' ? 'running' : 'idle'}
                    desc={`Execution ${exec.status} via ${exec.trigger_type}`}
                    time={formatRelativeTime(exec.created_at)}
                  />
                </Link>
              ))
            )}
          </div>
          <div className="p-4 bg-surface-container-lowest rounded-b-xl text-center">
            <Link href="/executions" className="text-xs font-bold text-primary hover:underline uppercase tracking-widest">View All Executions</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

function MetricCard({ title, value, icon, trend, color, pulse = false }: any) {
  const colorMap: any = {
    primary: 'bg-primary text-primary',
    tertiary: 'bg-tertiary text-tertiary',
    error: 'bg-error text-error',
  };
  const [bg, text] = colorMap[color].split(' ');

  return (
    <div className="bg-surface-container-low p-6 rounded-xl relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1 h-full ${bg}`}></div>
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-headline uppercase tracking-widest text-slate-400">{title}</span>
        <span className={`material-symbols-outlined ${text} opacity-50 ${pulse ? 'animate-pulse' : ''}`}>{icon}</span>
      </div>
      <div className={`text-4xl font-headline font-bold mb-1 ${color !== 'tertiary' ? text : ''}`}>{value}</div>
      <div className={`text-[10px] font-medium uppercase tracking-wider ${color === 'error' ? text : 'text-slate-500'}`}>
        {trend}
      </div>
    </div>
  );
}

function ActivityItem({ id, name, status, desc, time }: any) {
  const statusConfig: any = {
    success: { color: 'bg-primary shadow-[0_0_8px_#3cddc7]', text: 'text-slate-500' },
    error: { color: 'bg-error shadow-[0_0_8px_#ffb4ab]', text: 'text-error' },
    running: { color: 'bg-primary animate-pulse shadow-[0_0_8px_#3cddc7]', text: 'text-slate-500' },
    idle: { color: 'bg-primary opacity-50', text: 'text-slate-500' },
  };
  const config = statusConfig[status];

  return (
    <div className="flex gap-4">
      <div className={`w-2 h-2 rounded-full mt-1.5 ${config.color}`}></div>
      <div>
        <p className="text-sm font-mono text-on-surface"><span className="text-tertiary">#{id}</span> {name}</p>
        <p className={`text-xs mt-1 ${config.text}`}>{desc}</p>
        <span className="text-[10px] text-slate-600 uppercase mt-2 block">{time}</span>
      </div>
    </div>
  );
}
