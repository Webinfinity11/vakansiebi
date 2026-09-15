import type { Metadata } from 'next';
import { siteUrl } from '@/lib/seo';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import JobBoard from './job-board';
import { vacancyPath, safeReturnPath } from '@/lib/vacancy-navigation';
import { publicJobs } from '@/lib/server/jobs';
import type { BoardInitial } from '@/lib/board-return-cache';
import {
  boardSearchKey,
  readSearch,
  readSearchPage,
  searchParams as toSearchParams,
} from '@/lib/search-state';

async function InitialBoard({ params }: { params: URLSearchParams }) {
  const filters = readSearch(params);
  const request = toSearchParams(filters);
  const page = readSearchPage(params);
  request.set('summary', '1');
  request.set('page', String(page));
  let initial: BoardInitial | undefined;
  try {
    const result = await publicJobs(request);
    initial = {
      // The summary card never reads source history. A single posting can have
      // thousands of source checks; keep that detail out of the streamed seed.
      jobs: result.jobs.map((job) => ({ ...job, sources: [] })),
      total: result.total,
      pages: result.pages,
      search: result.search,
      companyLinksPending:
        'companyLinksPending' in result && result.companyLinksPending,
      key: boardSearchKey(filters),
      page,
    };
  } catch {
    // Keep the shell usable; the client supplies the normal retry/error UI.
    console.error('Initial vacancy list unavailable');
  }
  return <JobBoard initial={initial} />;
}
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const query = await searchParams;
  const filtered = Object.keys(query).some(
    (key) => !key.startsWith('utm_') && !['gclid', 'fbclid'].includes(key),
  );
  return {
    alternates: { canonical: siteUrl + '/' },
    robots: filtered
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: 'JOBX — ვაკანსიები ერთ სივრცეში',
      description: 'მოძებნე ვაკანსიები საქართველოში და შეადარე პირობები.',
      url: siteUrl,
      siteName: 'JOBX',
      locale: 'ka_GE',
      type: 'website',
      images: ['/brand/jobx.png'],
    },
  };
}
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
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  return (
    <>
      {/* The headings use 700 (also synthesized for 800). Load it alongside
          the layout's 400/600 faces so the count and progress track stay put. */}
      <link
        rel="preload"
        href="/fonts/FiraGO-Bold-subset.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />
      <Suspense fallback={<JobBoard pendingInitial />}>
        {params.get('preview') === '1' || params.get('saved') === '1' ? (
          <JobBoard />
        ) : (
          <InitialBoard params={params} />
        )}
      </Suspense>
    </>
  );
}
