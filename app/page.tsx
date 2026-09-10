import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import JobBoard from './job-board';
import { vacancyPath, safeReturnPath } from '@/lib/vacancy-navigation';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (typeof query.job === 'string' && /^[a-f\d-]{36}$/i.test(query.job)) {
    const from = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (key !== 'job' && typeof value === 'string') from.set(key, value);
    redirect(
      vacancyPath(query.job, {
        preview: query.preview === '1',
        from: safeReturnPath('/?' + from),
      }),
    );
  }
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
