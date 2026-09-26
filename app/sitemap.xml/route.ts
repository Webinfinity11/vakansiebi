import { siteUrl } from '@/lib/seo';
import { datedSitemapLeaves, sitemapIndexResponse } from '@/lib/sitemap';

/* A sitemap index pointing at four independently cached leaf sitemaps (pages, categories,
   companies, jobs). Each leaf refreshes and fails on its own: a database outage that empties
   the job list does not touch the static pages list, and vice versa. This route never touches
   the database itself, so it is always available; each leaf's date is its newest address, read
   from the leaf as the edge serves it.

   force-dynamic (not force-static): Next.js static routes strip custom Response headers
   (Content-Type charset, Cache-Control, CDN-Cache-Control) and replace them with
   `max-age=0, must-revalidate`. The sitemapIndexResponse sets its own CDN caching, and
   Search Console needs `application/xml; charset=utf-8` — without it the sitemap shows as
   type "Unknown" and status "Couldn't fetch". The response also fetches leaf sitemaps to
   read their newest dates, which fails at build time when the leaves don't exist yet. */
export const dynamic = 'force-dynamic';

export async function GET() {
  return sitemapIndexResponse(await datedSitemapLeaves(siteUrl));
}
