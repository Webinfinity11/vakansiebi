import { searchesEntries } from '@/lib/server/sitemap-entries';
import { createSitemapHandler } from '@/lib/sitemap';
import { landingLinks } from '@/lib/seo-landing';
import { siteUrl } from '@/lib/seo';

// The CDN owns the successful response's TTL. Avoid storing a failed census
// in Next's static route cache for an hour despite its no-store response.
export const dynamic = 'force-dynamic';

/* The curated list needs no database, so a cold instance that cannot finish the
   census still names the pages this site is willing to be found by. */
const curated = () =>
  landingLinks().map(({ path }) => ({ url: siteUrl + path }));

export const GET = createSitemapHandler(searchesEntries, 25_000, curated);
