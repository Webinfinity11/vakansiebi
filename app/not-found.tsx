import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { PublicHeader } from './public-header';
import { ServerSiteFooter } from './server-site-footer';
import { TrackOnce } from './track-once';
export default function NotFound() {
  return (
    <div className="board-shell not-found-shell">
      <PublicHeader />
      <TrackOnce code="not_found" />
      <main className="not-found-main">
        <section className="not-found-card ds-appear">
          <span className="not-found-mark" aria-hidden="true">
            <SearchX />
          </span>
          <h1>გვერდი აღარ არის ხელმისაწვდომი</h1>
          <p>შესაძლოა განცხადების ვადა გავიდა ან ბმული შეიცვალა.</p>
          <Link className="primary" href="/">
            აქტიური ვაკანსიების ნახვა
          </Link>
        </section>
      </main>
      <ServerSiteFooter />
    </div>
  );
}
