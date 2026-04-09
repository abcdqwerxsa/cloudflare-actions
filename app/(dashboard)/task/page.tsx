import { Suspense } from 'react';
import TaskDetailClient from './TaskDetailClient';

export default function TaskDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 max-w-7xl mx-auto flex items-center justify-center h-96"><div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div><span className="ml-3 text-slate-400 text-sm">Loading task...</span></div>}>
      <TaskDetailClient />
    </Suspense>
  );
}
