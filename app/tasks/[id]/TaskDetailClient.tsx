'use client';
import { API_BASE } from '@/lib/api';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type TaskType = 'inline' | 'docker' | 'git';
type Runtime = 'python' | 'nodejs' | 'bash';

interface Task {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  status: string;
  schedule: string | null;
  runtime: Runtime | null;
  code: string;
  docker_image: string | null;
  command: string | null;
  git_url: string | null;
  git_branch: string;
  git_command: string | null;
  env_vars: string;
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

export default function TaskDetailClient() {
  const routeParams = useParams();
  const taskId = routeParams.id as string;
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [runtime, setRuntime] = useState<Runtime>('python');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [schedule, setSchedule] = useState('');
  const [envVarsText, setEnvVarsText] = useState('{}');
  const [dockerImage, setDockerImage] = useState('');
  const [command, setCommand] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitCommand, setGitCommand] = useState('');

  useEffect(() => { loadTask(); }, [taskId]);

  const loadTask = async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`);
      const data = await res.json();
      if (data.task) {
        setTask(data.task);
        setCode(data.task.code || '');
        setRuntime(data.task.runtime || 'python');
        setSchedule(data.task.schedule || '');
        setEnvVarsText(data.task.env_vars || '{}');
        setDockerImage(data.task.docker_image || '');
        setCommand(data.task.command || '');
        setGitUrl(data.task.git_url || '');
        setGitBranch(data.task.git_branch || 'main');
        setGitCommand(data.task.git_command || '');
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
      const body: any = { name: task.name, schedule: schedule || null, env_vars: envVarsText };
      if (task.type === 'inline') { body.runtime = runtime; body.code = code; }
      else if (task.type === 'docker') { body.docker_image = dockerImage; body.command = command; }
      else if (task.type === 'git') { body.git_url = gitUrl; body.git_branch = gitBranch; body.git_command = gitCommand; }
      await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      loadTask();
    } catch (err) { console.error('Failed to save:', err); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this task?')) return;
    try { await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' }); router.push('/tasks'); } catch {}
  };

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
            <span className="text-xs px-3 py-1 rounded bg-tertiary/10 text-tertiary border border-tertiary/20 capitalize">{task.type}</span>
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
            <div className="space-y-3">{executions.length === 0 ? <p className="text-xs text-slate-500 text-center py-4">No executions yet</p> : executions.map((exec) => (<Link key={exec.id} href={`/executions/${exec.id}`} className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/5 hover:border-primary/20 transition-colors"><div className="flex items-center gap-3"><div className={`w-1.5 h-1.5 rounded-full ${exec.status === 'success' ? 'bg-primary' : exec.status === 'failed' ? 'bg-error' : exec.status === 'running' ? 'bg-primary animate-pulse' : 'bg-slate-600'}`} /><span className="text-xs font-mono text-slate-300">{exec.id.slice(0, 8)}</span></div><div className="flex items-center gap-2"><span className="text-[10px] text-slate-500 uppercase">{exec.trigger_type}</span><span className={`text-[10px] font-bold ${exec.status === 'success' ? 'text-primary' : exec.status === 'failed' ? 'text-error' : 'text-slate-400'}`}>{exec.status.toUpperCase()}</span></div></Link>))}</div>
          </section>
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
            <h2 className="text-sm font-headline font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2"><span className="material-symbols-outlined text-lg">key</span>Environment Variables</h2>
            <textarea className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono text-tertiary focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none resize-none" rows={4} value={envVarsText} onChange={(e) => setEnvVarsText(e.target.value)} placeholder='{"KEY": "value"}' />
          </section>
        </div>
        <div className="lg:col-span-8 flex flex-col gap-4">
          {task.type === 'inline' && (<div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col relative" style={{ minHeight: '400px' }}><div className="bg-surface-container-low/80 backdrop-blur px-4 py-3 flex justify-between items-center border-b border-outline-variant/10"><div className="flex items-center gap-4"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span><span className="text-xs font-mono font-medium text-slate-300">task.{runtime === 'python' ? 'py' : runtime === 'nodejs' ? 'js' : 'sh'}</span></div><div className="h-4 w-px bg-outline-variant/20"></div><div className="flex gap-2">{(['python', 'nodejs', 'bash'] as Runtime[]).map((r) => (<button key={r} onClick={() => setRuntime(r)} className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${runtime === r ? 'bg-primary/20 text-primary' : 'text-slate-500 hover:text-slate-300'}`}>{r === 'nodejs' ? 'Node.js' : r.charAt(0).toUpperCase() + r.slice(1)}</button>))}</div></div><button onClick={handleRun} disabled={isRunning} className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs font-bold transition-colors disabled:opacity-50"><span className="material-symbols-outlined text-sm">play_arrow</span>{isRunning ? 'RUNNING...' : 'TEST RUN'}</button></div><div className="flex-1 relative flex"><div className="w-12 bg-surface-container-low/30 border-r border-outline-variant/5 text-right pr-3 pt-4 text-slate-600 select-none text-[11px] font-mono leading-relaxed">{code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div><textarea value={code} onChange={(e) => setCode(e.target.value)} className="flex-1 bg-transparent text-on-surface font-mono text-sm leading-relaxed p-4 outline-none resize-none whitespace-pre" spellCheck={false} /></div></div>)}
          {task.type === 'docker' && (<div className="space-y-4"><section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10"><label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Docker Image</label><input className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none" type="text" value={dockerImage} onChange={(e) => setDockerImage(e.target.value)} /></section><section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10"><label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Command</label><textarea className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none resize-none" rows={6} value={command} onChange={(e) => setCommand(e.target.value)} /></section></div>)}
          {task.type === 'git' && (<div className="space-y-4"><section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10"><label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Repository URL</label><input className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none" type="text" value={gitUrl} onChange={(e) => setGitUrl(e.target.value)} /></section><div className="grid grid-cols-2 gap-4"><section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10"><label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Branch</label><input className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none" type="text" value={gitBranch} onChange={(e) => setGitBranch(e.target.value)} /></section><section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10"><label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Command</label><input className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none" type="text" value={gitCommand} onChange={(e) => setGitCommand(e.target.value)} /></section></div></div>)}
          <div className="h-48 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col"><div className="bg-surface-container-low/80 px-4 py-2 flex items-center border-b border-outline-variant/10"><span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Execution Output</span></div><div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap">{output || 'Ready to execute...'}</div></div>
          <div className="flex items-center justify-between">
            <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 text-error hover:bg-error/10 rounded-lg transition-all text-xs font-bold font-headline"><span className="material-symbols-outlined text-lg">delete</span>DELETE TASK</button>
            <div className="flex items-center gap-4"><Link href="/tasks" className="px-6 py-2.5 text-on-surface border border-outline-variant/30 hover:bg-surface-container-high rounded-lg transition-all text-xs font-bold font-headline tracking-widest">CANCEL</Link><button onClick={handleSave} disabled={saving} className="px-8 py-2.5 bg-primary text-on-primary hover:opacity-90 rounded-lg transition-all text-xs font-bold font-headline tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"><span className="material-symbols-outlined text-lg">save</span>{saving ? 'SAVING...' : 'SAVE CHANGES'}</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}
