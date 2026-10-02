import { siteUrl } from '@/lib/seo';
import { sitemapLeaves, sitemapIndexResponse } from '@/lib/sitemap';

/* A sitemap index pointing at four independently cached leaf sitemaps (pages, categories,
   companies, jobs). Each leaf refreshes and fails on its own: a database outage that empties
   the job list does not touch the static pages list, and vice versa. The index needs no
   database or HTTP requests. Index lastmod describes the sitemap file, not its pages;
   omit it until we track when the file's contents actually change.
   force-dynamic keeps the response's explicit XML and cache headers. */
export const dynamic = 'force-dynamic';

export function GET() {
  return sitemapIndexResponse(sitemapLeaves(siteUrl));
}
