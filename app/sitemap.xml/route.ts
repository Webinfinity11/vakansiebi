import { siteUrl } from '@/lib/seo';
import { sitemapIndexResponse, sitemapLeaves } from '@/lib/sitemap';

/* A sitemap index pointing at four independently cached leaf sitemaps (pages, categories,
   companies, jobs). Each leaf refreshes and fails on its own: a database outage that empties
   the job list does not touch the static pages list, and vice versa. This route never touches
   the database itself, so it is always available. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  return sitemapIndexResponse(sitemapLeaves(siteUrl));
}
