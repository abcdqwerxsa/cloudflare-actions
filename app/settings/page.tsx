'use client';
import { API_BASE } from '@/lib/api';
import { useState, useEffect } from 'react';

interface ApiKeyDisplay {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export default function Settings() {
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const res = await fetch(`${API_BASE}/keys`);
      const data = await res.json();
      if (data.keys) setKeys(data.keys);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await res.json();
      if (data.key) {
        setCreatedKey(data.key);
        setNewKeyName('');
        loadKeys();
      }
    } catch (err) {
      console.error('Failed to create key:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this API key? Any integrations using it will stop working.')) return;
    try {
      await fetch(`${API_BASE}/keys/${id}`, { method: 'DELETE' });
      setKeys(keys.filter((k) => k.id !== id));
    } catch (err) {
      console.error('Failed to delete key:', err);
    }
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight font-headline text-on-surface mb-2">Settings</h2>
        <p className="text-slate-400 text-sm">Manage API keys and system configuration.</p>
      </div>

      {/* API Keys Section */}
      <div className="bg-surface-container-low rounded-xl border border-teal-900/10 overflow-hidden mb-8">
        <div className="p-6 border-b border-teal-900/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-headline font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">key</span>
                API Keys
              </h3>
              <p className="text-xs text-slate-500 mt-1">Use API keys to authenticate external requests.</p>
            </div>
          </div>
        </div>

        {/* Create new key */}
        <div className="p-6 border-b border-teal-900/10 bg-surface-container-lowest/30">
          <div className="flex gap-3">
            <input
              className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary focus:border-primary text-on-surface outline-none"
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. CI/CD Pipeline)"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="px-5 py-2.5 bg-primary text-on-primary font-bold rounded-lg text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Create Key
            </button>
          </div>

          {/* Show created key */}
          {createdKey && (
            <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-primary font-bold mb-1">API Key Created (copy now - won't be shown again):</p>
                  <code className="text-sm font-mono text-on-surface select-all">{createdKey}</code>
                </div>
                <div className="flex gap-2">
                  <button onClick={copyKey} className="p-2 text-primary hover:bg-primary/10 rounded transition-all">
                    <span className="material-symbols-outlined text-sm">content_copy</span>
                  </button>
                  <button onClick={() => setCreatedKey(null)} className="p-2 text-slate-400 hover:bg-surface-container-high rounded transition-all">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Key list */}
        <div className="divide-y divide-teal-900/5">
          {loading ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              <span className="material-symbols-outlined text-2xl animate-pulse">loading</span>
            </div>
          ) : keys.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No API keys yet. Create one above to get started.
            </div>
          ) : (
            keys.map((key) => (
              <div key={key.id} className="px-6 py-4 flex items-center justify-between hover:bg-surface-container-high/30 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-slate-400">vpn_key</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{key.name}</p>
                    <p className="text-xs text-slate-500 font-mono">
                      {key.key_prefix}{'*'.repeat(24)}
                      {key.last_used_at && <span className="ml-3 text-slate-600">Last used: {new Date(key.last_used_at).toLocaleDateString()}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-slate-600">Created {new Date(key.created_at).toLocaleDateString()}</span>
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="p-2 text-slate-400 hover:text-error transition-colors"
                    title="Delete key"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="bg-surface-container-low rounded-xl border border-teal-900/10 p-6">
        <h3 className="text-sm font-headline font-bold text-primary uppercase tracking-widest flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-lg">info</span>
          System Information
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-surface-container-lowest rounded-lg">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Platform</p>
            <p className="text-sm text-on-surface font-bold">Cloudflare Workers</p>
          </div>
          <div className="p-4 bg-surface-container-lowest rounded-lg">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Runtime</p>
            <p className="text-sm text-on-surface font-bold">Containers + D1</p>
          </div>
          <div className="p-4 bg-surface-container-lowest rounded-lg">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Scheduler</p>
            <p className="text-sm text-on-surface font-bold">Cron Triggers</p>
          </div>
          <div className="p-4 bg-surface-container-lowest rounded-lg">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">API Keys</p>
            <p className="text-sm text-on-surface font-bold">{keys.length} active</p>
          </div>
        </div>
      </div>
    </div>
  );
}
