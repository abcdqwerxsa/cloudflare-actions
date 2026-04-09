'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('error') === '1');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = '/';
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: "'Space Grotesk', sans-serif",
      background: '#0b1326',
      color: '#dae2fd',
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#131b2e',
        borderRadius: 16,
        padding: 48,
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 0 60px rgba(60,221,199,0.05)',
        border: '1px solid rgba(60,221,199,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8, background: '#00a392',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 20 }}>terminal</span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#3cddc7', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            The Orchestrator
          </span>
        </div>
        <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#64748b', textTransform: 'uppercase', marginBottom: 32, paddingLeft: 52 }}>
          Precision Infrastructure
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Welcome back</h2>
        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>Enter your password to access the control panel.</p>

        {error && (
          <div style={{
            background: 'rgba(255,180,171,0.1)', border: '1px solid rgba(255,180,171,0.2)',
            color: '#ffb4ab', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
          }}>
            Invalid password. Please try again.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
              required
              style={{
                width: '100%', padding: '12px 14px', background: '#0b1326',
                border: '1px solid rgba(60,221,199,0.15)', borderRadius: 8,
                color: '#dae2fd', fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", outline: 'none',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 12,
              background: 'linear-gradient(135deg,#00a392,#3cddc7)',
              color: '#0b1326', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock_open</span>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#475569' }}>
          Cloudflare Actions &middot; Secure Access
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0b1326' }} />}>
      <LoginForm />
    </Suspense>
  );
}
