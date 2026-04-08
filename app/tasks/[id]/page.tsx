'use client';
import { useState, use } from 'react';
import Link from 'next/link';

export default function TaskConfig({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const isNew = resolvedParams.id === 'new';
  const [code, setCode] = useState(`import os
import json
from datetime import datetime

# Initialized data processing pipeline
def handler(event, context):
    timestamp = datetime.now().isoformat()
    print(f"Starting execution at {timestamp}")
    
    # Fetch source data from internal API
    raw_data = fetch_upstream_metrics()
    
    # Validate structure
    if not raw_data:
        return {
            "status": "error",
            "message": "Data source unavailable"
        }
        
    # Run normalization
    processed = normalize(raw_data)
    return processed
`);

  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [language, setLanguage] = useState('python');

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Executing...\\n');
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language })
      });
      const data = await res.json();
      if (data.error) {
        setOutput(`Error: ${data.error}\\n${data.stderr || ''}`);
      } else {
        setOutput(`${data.stdout}\\n${data.stderr || ''}`);
      }
    } catch (err: any) {
      setOutput(`Failed to execute: ${err.message}`);
    } finally {
      setIsRunning(false);
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
          <span className="text-on-surface">Configuration</span>
        </nav>
        <h1 className="text-4xl font-headline font-bold text-on-surface tracking-tight">
          {isNew ? 'Create Task' : 'Configure Task'} <span className="text-primary opacity-50">{!isNew && `#${resolvedParams.id}`}</span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
            <h2 className="text-sm font-headline font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">info</span>
              Core Metadata
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Task Identifier</label>
                <input 
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none" 
                  type="text" 
                  defaultValue={isNew ? '' : resolvedParams.id}
                  placeholder="e.g. data-pipeline-alpha"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Runtime Environment</label>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setLanguage('python')} className={`${language === 'python' ? 'bg-primary text-on-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' : 'bg-surface-container-high text-on-surface border border-outline-variant/20 hover:bg-surface-container-highest'} py-2 px-3 rounded text-xs font-bold transition-all`}>Python</button>
                  <button onClick={() => setLanguage('nodejs')} className={`${language === 'nodejs' ? 'bg-primary text-on-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' : 'bg-surface-container-high text-on-surface border border-outline-variant/20 hover:bg-surface-container-highest'} py-2 px-3 rounded text-xs font-bold transition-all`}>Node.js</button>
                  <button onClick={() => setLanguage('bash')} className={`${language === 'bash' ? 'bg-primary text-on-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]' : 'bg-surface-container-high text-on-surface border border-outline-variant/20 hover:bg-surface-container-highest'} py-2 px-3 rounded text-xs font-bold transition-all`}>Bash</button>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 shadow-sm">
            <h2 className="text-sm font-headline font-bold text-primary mb-6 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">schedule</span>
              Execution Schedule
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Cron Expression</label>
                <div className="relative">
                  <input 
                    className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-lg pl-4 pr-10 py-2.5 text-sm font-mono text-tertiary focus:ring-1 focus:ring-primary focus:border-primary outline-none" 
                    type="text" 
                    defaultValue="0 0 * * *"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">help</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button className="bg-surface-container-highest text-[10px] p-2 rounded border border-primary/20 text-primary">Daily</button>
                <button className="bg-surface-container-low text-[10px] p-2 rounded border border-outline-variant/10 text-slate-400 hover:bg-surface-container-high transition-colors">Weekly</button>
                <button className="bg-surface-container-low text-[10px] p-2 rounded border border-outline-variant/10 text-slate-400 hover:bg-surface-container-high transition-colors">Monthly</button>
                <button className="bg-surface-container-low text-[10px] p-2 rounded border border-outline-variant/10 text-slate-400 hover:bg-surface-container-high transition-colors">Hourly</button>
              </div>
            </div>
          </section>
        </div>

        <div className="lg:col-span-8 flex flex-col h-full min-h-[640px] gap-4">
          <div className="flex-1 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col relative">
            <div className="bg-surface-container-low/80 backdrop-blur px-4 py-3 flex justify-between items-center border-b border-outline-variant/10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-xs font-mono font-medium text-slate-300">main.{language === 'python' ? 'py' : language === 'nodejs' ? 'js' : 'sh'}</span>
                </div>
                <div className="h-4 w-px bg-outline-variant/20"></div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">UTF-8</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRun} disabled={isRunning} className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs font-bold transition-colors">
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                  {isRunning ? 'RUNNING...' : 'TEST RUN'}
                </button>
              </div>
            </div>
            
            <div className="flex-1 relative flex">
              <div className="w-12 bg-surface-container-low/30 border-r border-outline-variant/5 text-right pr-3 pt-4 text-slate-600 select-none text-[11px] font-mono leading-relaxed">
                {code.split('\\n').map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 bg-transparent text-on-surface font-mono text-sm leading-relaxed p-4 outline-none resize-none whitespace-pre"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Output Terminal */}
          <div className="h-48 bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden flex flex-col">
            <div className="bg-surface-container-low/80 px-4 py-2 flex items-center border-b border-outline-variant/10">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Execution Output</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {output || 'Ready to execute...'}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button className="flex items-center gap-2 px-4 py-2 text-error hover:bg-error/10 rounded-lg transition-all text-xs font-bold font-headline">
              <span className="material-symbols-outlined text-lg">delete</span>
              DISCARD CHANGES
            </button>
            <div className="flex items-center gap-4">
              <Link href="/tasks" className="px-6 py-2.5 text-on-surface border border-outline-variant/30 hover:bg-surface-container-high rounded-lg transition-all text-xs font-bold font-headline tracking-widest">
                CANCEL
              </Link>
              <button className="px-8 py-2.5 bg-primary text-on-primary hover:opacity-90 rounded-lg transition-all text-xs font-bold font-headline tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">save</span>
                SAVE ORCHESTRATION
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
