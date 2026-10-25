import { UiText } from '@/app/ui-language';
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
      <title>
        <UiText>{'დამსაქმებლის გვერდი ვერ მოიძებნა | JOBX'}</UiText>
      </title>
      <TrackOnce code="not_found" />
      <main className="not-found-main">
        <section className="not-found-card ds-appear">
          <span className="not-found-mark" aria-hidden="true">
            <Building2 />
          </span>
          <h1>
            <UiText>{'დამსაქმებლის გვერდი ვერ მოიძებნა'}</UiText>
          </h1>
          <p>
            <UiText>
              {'ამ დამსაქმებელს ახლა საკმარისი აქტიური ვაკანსია არ აქვს.'}
            </UiText>
          </p>
          <div className="not-found-actions">
            <Link className="primary" href="/">
              <UiText>{'ყველა ვაკანსიის ნახვა'}</UiText>
            </Link>
            <Link
              className="secondary-button"
              href="/companies"
              prefetch={false}
            >
              <UiText>{'კომპანიების სია'}</UiText>
            </Link>
          </div>
        </section>
      </main>
      <ServerSiteFooter />
    </div>
  );
}
