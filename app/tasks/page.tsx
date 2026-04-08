import Link from 'next/link';

export default function Tasks() {
  const tasks = [
    { id: 'db-maint-042', name: 'Database Optimizer', status: 'Running', schedule: '0 0 * * *', lastRun: '12 minutes ago' },
    { id: 'storage-worker-9', name: 'S3 Asset Sync', status: 'Failed', schedule: '*/15 * * * *', lastRun: '3 hours ago (Timeout)' },
    { id: 'fin-report-gen', name: 'Monthly Billing Export', status: 'Idle', schedule: '0 0 1 * *', lastRun: '22 days ago' },
    { id: 'sec-monitor-v2', name: 'Security Heartbeat', status: 'Running', schedule: '*/1 * * * *', lastRun: 'Just now' },
    { id: 'comms-relay', name: 'Email Digest Batch', status: 'Idle', schedule: '0 9 * * 1-5', lastRun: '1 day ago' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline text-on-surface mb-2">Tasks</h2>
          <p className="text-slate-400 text-sm">Orchestrating <span className="text-primary">12 active</span> automated instances across the cluster.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-sm border border-outline-variant text-on-surface rounded hover:bg-surface-container-high transition-all">
            <span className="material-symbols-outlined text-sm">filter_list</span>
            Filter
          </button>
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
                <th className="px-6 py-4">Last Run</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-900/5">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-surface-container-high transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-8 rounded-full ${task.status === 'Running' ? 'bg-primary' : task.status === 'Failed' ? 'bg-error' : 'bg-slate-700'}`}></div>
                      <div>
                        <Link href={`/tasks/${task.id}`} className="text-sm font-bold text-on-surface leading-none hover:text-primary transition-colors">{task.name}</Link>
                        <p className="text-[10px] text-slate-500 mt-1">{task.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-6 py-5">
                    <code className="text-xs font-mono text-tertiary bg-surface-container-lowest px-2 py-1 rounded">{task.schedule}</code>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`text-xs ${task.status === 'Failed' ? 'text-error/80' : 'text-slate-400'}`}>{task.lastRun}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-slate-400 hover:text-primary transition-colors" title="Run Now">
                        <span className="material-symbols-outlined text-xl">play_arrow</span>
                      </button>
                      <Link href={`/tasks/${task.id}`} className="p-2 text-slate-400 hover:text-tertiary transition-colors" title="Edit">
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </Link>
                      <button className="p-2 text-slate-400 hover:text-error transition-colors" title="Delete">
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'Running') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/5 px-2 py-1 rounded border border-primary/20">
        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(60,221,199,0.7)] animate-pulse"></div>
        Running
      </div>
    );
  }
  if (status === 'Failed') {
    return (
      <div className="inline-flex items-center gap-2 text-xs font-medium text-error px-2 py-1">
        <span className="material-symbols-outlined text-sm">warning</span>
        Failed
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
