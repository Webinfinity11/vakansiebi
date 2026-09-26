import { siteUrl } from '@/lib/seo';
import { datedSitemapLeaves, sitemapIndexResponse } from '@/lib/sitemap';

/* The same sitemap index as /sitemap.xml under a second address. Search Console keeps its
   state per submitted URL, so an address it has never seen gets a fresh fetch rather than
   whatever record is stuck against the old one. Both addresses point at the same four leaf
   sitemaps. force-dynamic for the same reason as /sitemap.xml (see that route's comment). */
export const dynamic = 'force-dynamic';

export async function GET() {
  return sitemapIndexResponse(await datedSitemapLeaves(siteUrl));
}
