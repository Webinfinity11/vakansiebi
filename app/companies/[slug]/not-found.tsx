import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { PublicHeader } from '../../public-header';
import { ServerSiteFooter } from '../../server-site-footer';
import { TrackOnce } from '../../track-once';
import './company.css';
export default function NotFound() {
  return (
    <div className="board-shell not-found-shell">
      <PublicHeader />
      <TrackOnce code="not_found" />
      <main className="not-found-main">
        <section className="not-found-card ds-appear">
          <span className="not-found-mark" aria-hidden="true">
            <Building2 />
          </span>
          <h1>დამსაქმებლის გვერდი ვერ მოიძებნა</h1>
          <p>ამ დამსაქმებელს ახლა საკმარისი აქტიური ვაკანსია არ აქვს.</p>
          <div className="not-found-actions">
            <Link className="primary" href="/">
              ყველა ვაკანსიის ნახვა
            </Link>
            <Link
              className="secondary-button"
              href="/companies"
              prefetch={false}
            >
              კომპანიების სია
            </Link>
          </div>
        </section>
      </main>
      <ServerSiteFooter />
    </div>
  );
}
