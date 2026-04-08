'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: 'dashboard' },
    { name: 'Tasks', href: '/tasks', icon: 'terminal' },
    { name: 'Executions', href: '/executions', icon: 'history' },
    { name: 'Settings', href: '/settings', icon: 'settings' },
  ];

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-[#0b1326] border-r border-teal-900/20 z-50 font-headline tracking-tight">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
          </div>
          <h1 className="text-xl font-bold text-primary tracking-widest uppercase">The Orchestrator</h1>
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-medium pl-11">Precision Infrastructure</div>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive ? 'text-primary bg-surface-container-low border-r-4 border-primary' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-container-high'}`}>
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-teal-900/10 mt-auto">
        <div className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
          <span className="material-symbols-outlined">menu_book</span>
          <span className="text-sm font-medium">Docs</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer">
          <span className="material-symbols-outlined">help_outline</span>
          <span className="text-sm font-medium">Help</span>
        </div>
        
        <div className="mt-6 flex items-center gap-3 px-4 py-3 bg-surface-container-low rounded-xl border border-teal-900/20">
          <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden flex items-center justify-center text-primary font-bold">
            A
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-on-surface truncate leading-none">Admin Control</p>
            <p className="text-[10px] text-slate-500 truncate mt-1">Node-01-Global</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
