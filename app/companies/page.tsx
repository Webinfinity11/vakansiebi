import { UiText } from '@/app/ui-language';
import type { Metadata } from 'next';
import { siteName } from '@/lib/site-brand';
import Link from 'next/link';
import { cache } from 'react';
import { Building2, ChevronLeft } from 'lucide-react';
import { PublicHeader } from '../public-header';
import { ServerSiteFooter } from '../server-site-footer';
import { TrackOnce } from '../track-once';
import { CompaniesDirectory } from './companies-directory';
import { companiesDirectory } from '@/lib/server/employers';
import {
  breadcrumbs,
  companiesCollection,
  jsonLd,
  shareImage,
  siteUrl,
} from '@/lib/seo';
import './companies.css';

/* Read on every request like the company pages it lists; the directory itself is cached with
   them for thirty minutes. */
export const dynamic = 'force-dynamic';

/* One read per request for the metadata and the page. A failed read is an empty directory
   with a sentence saying so, never an error page. */
const read = cache(async () => {
  try {
    return await companiesDirectory();
  } catch {
    return null;
  }
});

const canonical = `${siteUrl}/companies`;

export async function generateMetadata(): Promise<Metadata> {
  const companies = await read();
  const title = `კომპანიები და მათი აქტიური ვაკანსიები | ${siteName}`;
  const description = companies?.length
    ? `${companies.length} კომპანია, რომელიც ახლა ასაქმებს: ნახე თითოეულის აქტიური ვაკანსიები ერთ გვერდზე — ${companies
        .slice(0, 3)
        .map((c) => c.name)
        .join(', ')} და სხვები.`.slice(0, 200)
    : 'კომპანიები, რომლებიც ახლა ასაქმებენ, და მათი აქტიური ვაკანსიები ერთ გვერდზე.';
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      images: [shareImage],
      title,
      description,
      url: canonical,
      type: 'website',
      locale: 'ka_GE',
      siteName,
    },
  };
}

export default async function CompaniesPage() {
  const companies = await read();
  return (
    <div className="board-shell vacancy-page companies-page">
      {companies && companies.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd([
              companiesCollection(companies),
              breadcrumbs([
                { name: 'ვაკანსიები', path: '/' },
                { name: 'კომპანიები', path: '/companies' },
              ]),
            ]),
          }}
        />
      )}
      <PublicHeader />
      <TrackOnce code="companies_page" />
      <main className="vacancy-page-main">
        <nav className="vacancy-breadcrumb" aria-label="გვერდის მდებარეობა">
          <Link href="/" prefetch={false}>
            <ChevronLeft size={16} aria-hidden="true" />
            <UiText>{'ვაკანსიები'}</UiText>
          </Link>
          <span aria-hidden="true">/</span>
          <span>
            <UiText>{'კომპანიები'}</UiText>
          </span>
        </nav>
        {companies && companies.length > 0 ? (
          <CompaniesDirectory companies={companies}>
            <h1>
              <UiText>{'კომპანიები'}</UiText>
            </h1>
          </CompaniesDirectory>
        ) : (
          <>
            <header className="companies-head">
              <h1>
                <UiText>{'კომპანიები'}</UiText>
              </h1>
            </header>
            <section className="companies-empty ds-appear">
              <span className="companies-empty-mark" aria-hidden="true">
                <Building2 size={20} />
              </span>
              <h2>
                {companies ? (
                  <UiText>კომპანიების სია ჯერ ცარიელია</UiText>
                ) : (
                  <UiText>კომპანიების სია ახლა ვერ ჩაიტვირთა</UiText>
                )}
              </h2>
              <p>
                {companies ? (
                  <UiText>სია ვაკანსიების განახლებასთან ერთად შეივსება.</UiText>
                ) : (
                  <UiText>
                    სცადე ცოტა ხანში. ვაკანსიები ამ დროსაც ხელმისაწვდომია.
                  </UiText>
                )}
              </p>
              <Link
                className="ds-btn ds-btn--secondary"
                href="/"
                prefetch={false}
              >
                <UiText>{'ყველა ვაკანსიის ნახვა'}</UiText>
              </Link>
            </section>
          </>
        )}
      </main>
      <ServerSiteFooter />
    </div>
  );
}
