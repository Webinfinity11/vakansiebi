import { siteUrl } from '@/lib/seo';
import { sitemapLeaves, sitemapIndexResponse } from '@/lib/sitemap';

/* Keep this previously submitted address compatible with /sitemap.xml. Both indexes list
   the same four leaf files without fetching them or inventing modification dates. */
export const dynamic = 'force-dynamic';

export function GET() {
  return sitemapIndexResponse(sitemapLeaves(siteUrl));
}
