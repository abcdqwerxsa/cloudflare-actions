import Link from 'next/link';

import TemplatesClient from './TemplatesClient';
import { TASK_TEMPLATE_SUMMARIES } from '@/lib/task-templates.generated';

export default function TaskTemplatesPage() {
  const categories = Array.from(new Set(TASK_TEMPLATE_SUMMARIES.map((template) => template.category)));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="flex items-center gap-2 text-xs font-mono text-tertiary mb-2 uppercase tracking-widest">
            <Link href="/" className="hover:text-primary transition-colors">Infrastructure</Link>
            <span className="text-slate-600">/</span>
            <Link href="/tasks" className="hover:text-primary transition-colors">Tasks</Link>
            <span className="text-slate-600">/</span>
            <span className="text-on-surface">Templates</span>
          </nav>
          <h1 className="text-4xl font-headline font-bold text-on-surface tracking-tight">Task Templates</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Pick a runnable starting point with cron, environment variables, scripts, and config files already wired in. You can either create the default task immediately or open it in the editor first.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/tasks/new"
            className="flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-bold font-headline tracking-widest text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-base">edit_square</span>
            BLANK TASK
          </Link>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Templates</div>
            <div className="mt-2 text-3xl font-headline font-bold text-on-surface">{TASK_TEMPLATE_SUMMARIES.length}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Categories</div>
            <div className="mt-2 text-xl font-headline font-bold text-on-surface">{categories.join(' / ')}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">Default Runtime</div>
            <div className="mt-2 text-xl font-headline font-bold text-on-surface">Python in Cloudflare Containers</div>
          </div>
        </div>
      </div>

      <TemplatesClient templates={TASK_TEMPLATE_SUMMARIES} />
    </div>
  );
}
