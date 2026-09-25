import { siteUrl } from '@/lib/seo';
import { datedSitemapLeaves, sitemapIndexResponse } from '@/lib/sitemap';

/* The same sitemap index as /sitemap.xml under a second address. Search Console keeps its
   state per submitted URL, so an address it has never seen gets a fresh fetch rather than
   whatever record is stuck against the old one. Both addresses point at the same four leaf
   sitemaps. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  return sitemapIndexResponse(await datedSitemapLeaves(siteUrl));
}
