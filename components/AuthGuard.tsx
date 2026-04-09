'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === '/login') {
      setChecked(true);
      return;
    }
    fetch('/api/auth/check').then(res => {
      if (res.status === 401) {
        window.location.href = '/login';
      } else {
        setChecked(true);
      }
    }).catch(() => {
      setChecked(true);
    });
  }, [pathname]);

  if (pathname === '/login') return <>{children}</>;
  if (!checked) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }

  return <>{children}</>;
}
