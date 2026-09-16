import { siteUrl } from '@/lib/seo';
import { urlsetResponse } from '@/lib/sitemap';

export const dynamic = 'force-static';

/* The pages that exist without a vacancy behind them. Posting a vacancy is how
   an employer arrives, and it was missing from every sitemap. */
const paths = ['/', '/post-job'];

export function GET() {
  return urlsetResponse(paths.map((path) => ({ url: `${siteUrl}${path}` })));
}
