import { UiText } from '@/app/ui-language';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { PublicHeader } from './public-header';
import { ServerSiteFooter } from './server-site-footer';
import { TrackOnce } from './track-once';
export default function NotFound() {
  return (
    <div className="board-shell not-found-shell">
      <PublicHeader />
      <title>
        <UiText>{'გვერდი ვერ მოიძებნა | JOBX'}</UiText>
      </title>
      <TrackOnce code="not_found" />
      <main className="not-found-main">
        <section className="not-found-card ds-appear">
          <span className="not-found-mark" aria-hidden="true">
            <SearchX />
          </span>
          <h1>
            <UiText>{'გვერდი აღარ არის ხელმისაწვდომი'}</UiText>
          </h1>
          <p>
            <UiText>
              {'შესაძლოა, განცხადების ვადა გავიდა ან ბმული შეიცვალა.'}
            </UiText>
          </p>
          <Link className="primary" href="/">
            <UiText>{'აქტიური ვაკანსიების ნახვა'}</UiText>
          </Link>
        </section>
      </main>
      <ServerSiteFooter />
    </div>
  );
}
