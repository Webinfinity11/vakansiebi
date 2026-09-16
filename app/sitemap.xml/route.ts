import { sitemapIndexResponse } from '@/lib/sitemap';

// Keep the already submitted URL available without a redirect.
export const dynamic = 'force-static';

export function GET() {
  return sitemapIndexResponse();
}
