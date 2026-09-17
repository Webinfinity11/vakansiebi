import type { Metadata } from 'next';
import { shareImage, siteUrl } from '@/lib/seo';
import {
  landingDescription,
  landingFor,
  landingHeading,
} from '@/lib/seo-landing';
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
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const filtered = [...params.keys()].some(
    (key) => !key.startsWith('utm_') && !['gclid', 'fbclid'].includes(key),
  );
  /* A category, a city, remote work and their combinations are searches people
     actually make, so those lists are worth being found by and describe
     themselves. Every other combination — free text, a salary floor, a sort
     order, page nine — is an endless space that says nothing new, and stays
     out of the index while still passing its links on. */
  const landing = filtered ? landingFor(params) : null;
  const heading = landing && landingHeading(landing);
  const title = heading
    ? `${heading} | JOBX`
    : 'JOBX — ვაკანსიები ერთ სივრცეში';
  const description = landing
    ? landingDescription(landing)
    : 'მოძებნე ვაკანსიები საქართველოში და შეადარე პირობები.';
  return {
    ...(heading ? { title, description } : {}),
    alternates: { canonical: siteUrl + (landing ? landing.path : '/') },
    robots:
      filtered && !landing
        ? { index: false, follow: true }
        : { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: siteUrl + (landing ? landing.path : ''),
      siteName: 'JOBX',
      locale: 'ka_GE',
      type: 'website',
      images: [shareImage],
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
