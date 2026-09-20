import { sitemapIndexResponse } from '@/lib/sitemap';

// The section URLs are fixed. Serve discovery from the CDN even if the
// database is unavailable; individual URL dates live in the section sitemaps.
export const dynamic = 'force-static';

export function GET() {
  return sitemapIndexResponse();
}
