export default function Topbar() {
  return (
    <header className="h-16 flex justify-between items-center px-8 z-40 bg-[#0b1326]/60 backdrop-blur-xl shadow-2xl shadow-teal-900/10 font-headline flex-shrink-0">
      <div className="flex items-center bg-surface-container-low rounded-lg px-4 py-1.5 w-96">
        <span className="material-symbols-outlined text-slate-400 text-sm">search</span>
        <input 
          className="bg-transparent border-none focus:ring-0 text-sm text-on-surface w-full ml-2 placeholder:text-slate-600 outline-none" 
          placeholder="Search tasks or executions..." 
          type="text"
        />
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <button className="text-slate-400 hover:text-primary transition-all p-2 rounded-lg hover:bg-surface-container-high">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="text-slate-400 hover:text-primary transition-all p-2 rounded-lg hover:bg-surface-container-high">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
        <div className="h-8 w-px bg-teal-900/20 mx-2"></div>
        <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-surface-container-high transition-all">
          <span className="text-xs font-medium text-slate-300">System Ready</span>
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(60,221,199,0.7)] animate-pulse"></div>
        </button>
      </div>
    </header>
  );
}
