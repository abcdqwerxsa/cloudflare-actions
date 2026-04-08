export default function Settings() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight font-headline text-on-surface mb-2">Settings</h2>
        <p className="text-slate-400 text-sm">Configure cluster and orchestration parameters.</p>
      </div>
      <div className="bg-surface-container-low rounded-xl p-8 border border-teal-900/10 text-center text-slate-500">
        <span className="material-symbols-outlined text-4xl mb-4 opacity-50">settings</span>
        <p>System settings are currently managed via environment variables.</p>
      </div>
    </div>
  );
}
