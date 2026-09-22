import type { Metadata } from 'next';
import { jsonLd, shareImage, siteIdentity, siteUrl } from '@/lib/seo';
import { searchSeo } from '@/lib/search-seo';
import { cache, Suspense } from 'react';
import { notFound, redirect, permanentRedirect } from 'next/navigation';
import { canonicalSearchParams } from '@/lib/search-url';
import JobBoard from './job-board';
import { SearchDirectoryProvider } from './search-directory-context';
import { landingCounts } from '@/lib/server/sitemap-data';
import { landingFor, landingIndexable } from '@/lib/seo-landing';
import { vacancyPath, safeReturnPath } from '@/lib/vacancy-navigation';
import { publicJobs } from '@/lib/server/jobs';
import type { BoardInitial } from '@/lib/board-return-cache';
import {
  boardSearchKey,
  readSearch,
  readSearchPage,
  searchParams as toSearchParams,
} from '@/lib/search-state';

const readBoardJobs = cache((query: string) =>
  publicJobs(new URLSearchParams(query)),
);
const readDirectory = cache(async () => {
  try {
    return await landingCounts();
  } catch {
    return null;
  }
});
function boardJobs(params: URLSearchParams) {
  const request = toSearchParams(readSearch(params));
  request.set('summary', '1');
  request.set('page', String(readSearchPage(params)));
  return readBoardJobs(request.toString());
}

async function InitialBoard({ params }: { params: URLSearchParams }) {
  const directory = readDirectory();
  const filters = readSearch(params);
  const page = readSearchPage(params);
  let initial: BoardInitial | undefined;
  try {
    const result = await boardJobs(params);
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
  return (
    <SearchDirectoryProvider rows={directory}>
      <JobBoard key={`${boardSearchKey(filters)}:${page}`} initial={initial} />
    </SearchDirectoryProvider>
  );
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
  const { title, description, path, index: candidateIndex } = searchSeo(params);
  const base = new URLSearchParams(params);
  base.delete('page');
  const landing = landingFor(base);
  let index = candidateIndex;
  if (index && landing) {
    try {
      // Reuse this page's result count rather than wait for the entire directory.
      // The same eligibility function is used by the sitemap and footer.
      const result = await boardJobs(params);
      index = landingIndexable(landing, [{ ...landing, count: result.total }]);
    } catch {
      // A temporary database failure must not remove existing pages from search.
    }
  }
  // Out-of-range lists must not become an unlimited set of indexable empty
  // pages. The server seed reuses this request through React's render cache.
  if (index && readSearchPage(params) > 1) {
    const result = await boardJobs(params);
    if (readSearchPage(params) > result.pages) notFound();
  }
  return {
    title,
    description,
    alternates: { canonical: siteUrl + path },
    robots: { index, follow: true },
    openGraph: {
      title,
      description,
      url: siteUrl + path,
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
      /* A legacy `?job=` link carries no title; the vacancy's own page sends
         the reader on to the address that has its name in it. */
      vacancyPath(
        { id: query.job },
        {
          preview: query.preview === '1',
          from: safeReturnPath('/?' + from),
        },
      ),
    );
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const canonicalParams = canonicalSearchParams(params);
  if (canonicalParams.toString() !== params.toString())
    permanentRedirect('/?' + canonicalParams.toString());
  return (
    <>
      {/* Said once, on the front page: what this site is and how it is
          searched. A landing page is a list, not the site itself. */}
      {!params.size && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(siteIdentity()) }}
        />
      )}
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
