import { Suspense } from 'react';
import ExecutionDetailClient from './ExecutionDetailClient';

export default function ExecutionDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-7xl mx-auto flex items-center justify-center h-96"><span className="material-symbols-outlined text-4xl opacity-50 animate-pulse">loading</span></div>}>
      <ExecutionDetailClient />
    </Suspense>
  );
}
