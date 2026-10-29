import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PublicHeader } from './public-header';
import { SiteFooter } from './site-footer';
import { LocalText, type LocalCopy } from './local-text';
import { breadcrumbs, jsonLd } from '@/lib/seo';
import { siteName } from '@/lib/site-brand';
import './content-page.css';

export function ContentPage({
  path,
  title,
  intro,
  children,
}: {
  path: string;
  title: LocalCopy;
  intro: LocalCopy;
  children: ReactNode;
}) {
  return (
    <div className="board-shell">
      <PublicHeader />
      <main className="content-main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(
              breadcrumbs([
                { name: siteName, path: '/' },
                { name: title.ka, path },
              ]),
            ),
          }}
        />
        <nav className="content-breadcrumb" aria-label="გვერდის მდებარეობა">
          <Link href="/" prefetch={false}>
            <ChevronLeft size={15} aria-hidden="true" />
            <LocalText ka="ვაკანსიები" en="Jobs" />
          </Link>
          <span aria-hidden="true">/</span>
          <span>
            <LocalText {...title} />
          </span>
        </nav>
        <header className="content-intro">
          <h1>
            <LocalText {...title} />
          </h1>
          <p>
            <LocalText {...intro} />
          </p>
        </header>
        {children}
      </main>
      <SiteFooter showDirectory={false} />
    </div>
  );
}
