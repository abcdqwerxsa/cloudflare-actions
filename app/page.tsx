export default function Dashboard() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-headline font-bold text-on-surface tracking-tight">Infrastructure Overview</h1>
          <p className="text-tertiary text-sm mt-1">Live precision monitoring for production automation cluster.</p>
        </div>
        <div className="flex gap-4">
          <button className="px-4 py-2 border border-outline-variant text-on-surface rounded-lg text-sm font-medium hover:bg-surface-container-high transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download</span>
            Export Logs
          </button>
          <button className="px-4 py-2 bg-gradient-to-tr from-primary-container to-primary text-on-primary rounded-lg text-sm font-bold shadow-lg shadow-primary/10 hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">add</span>
            New Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard title="Total Tasks" value="1,284" icon="format_list_bulleted" trend="+12.4% from last week" color="tertiary" />
        <MetricCard title="Successful Runs" value="99.2%" icon="check_circle" trend="System-wide health" color="primary" />
        <MetricCard title="Failed Runs" value="12" icon="error_outline" trend="Requires attention" color="error" />
        <MetricCard title="Active Executions" value="84" icon="data_exploration" trend="Currently computing" color="primary" pulse />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-surface-container-low rounded-xl p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-headline text-lg font-bold">Execution Volume</h3>
              <p className="text-slate-500 text-xs uppercase tracking-widest">Real-time throughput (24h)</p>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">LIVE CLUSTER</span>
            </div>
          </div>
          <div className="h-64 flex items-end gap-1.5 w-full pt-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className={`flex-1 rounded-t transition-all cursor-pointer ${i === 12 ? 'bg-primary/60 hover:bg-primary h-[100%] relative' : 'bg-surface-container-high/40 hover:bg-primary/50'}`} style={{ height: i === 12 ? '100%' : `${Math.max(20, Math.random() * 80)}%` }}>
                {i === 12 && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-surface-container-highest/60 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white whitespace-nowrap">Peak: 4.2k ops</div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-tighter text-slate-500 mt-4 border-t border-teal-900/10 pt-4">
            <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>23:59</span>
          </div>
        </div>
        
        <div className="lg:col-span-4 bg-surface-container-low rounded-xl flex flex-col">
          <div className="p-6 border-b border-teal-900/10">
            <h3 className="font-headline text-lg font-bold">Recent Activity</h3>
            <p className="text-slate-500 text-xs uppercase tracking-widest">Global Event Stream</p>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px] p-6 space-y-6">
            <ActivityItem id="#7822" name="database-optimizer" status="success" desc="Execution completed successfully in 12ms" time="2 minutes ago" />
            <ActivityItem id="#7821" name="s3-backup-worker" status="error" desc="Error: Connection timeout at node-04" time="8 minutes ago" />
            <ActivityItem id="#7820" name="report-generator" status="running" desc="Currently running... (Process: 44%)" time="Just now" />
            <ActivityItem id="#7819" name="cache-invalidator" status="idle" desc="Scheduled task triggered" time="14 minutes ago" />
          </div>
          <div className="p-4 bg-surface-container-lowest rounded-b-xl text-center">
            <button className="text-xs font-bold text-primary hover:underline uppercase tracking-widest">View System Logs</button>
          </div>
        </div>
      </div>
    </div>
  );
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
        <p className="text-sm font-mono text-on-surface"><span className="text-tertiary">{id}</span> {name}</p>
        <p className={`text-xs mt-1 ${config.text}`}>{desc}</p>
        <span className="text-[10px] text-slate-600 uppercase mt-2 block">{time}</span>
      </div>
    </div>
  );
}
