import type { Metadata } from 'next';
import { PublicHeader } from '../public-header';
import { AlertConfirmation } from './confirmation';
import { siteName } from '@/lib/site-brand';
import '../job-alerts.css';
export const metadata: Metadata = {
  title: `ვაკანსიების გამოწერა | ${siteName}`,
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default async function JobAlertPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="board-shell">
      <PublicHeader />
      <main className="alert-management">
        <AlertConfirmation
          token={typeof params.token === 'string' ? params.token : ''}
          action={params.action === 'unsubscribe' ? 'unsubscribe' : 'confirm'}
        />
      </main>
    </div>
  );
}
