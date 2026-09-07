import { Suspense } from 'react';
import JobBoard from './job-board';
export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <p className="empty">ვაკანსიები იტვირთება…</p>
        </main>
      }
    >
      <JobBoard />
    </Suspense>
  );
}
