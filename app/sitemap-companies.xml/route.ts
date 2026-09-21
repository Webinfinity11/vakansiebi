import { companiesEntries } from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse } from '@/lib/sitemap';

/* Employer profile pages. Served with no-store on a database failure so the crawler retries
   soon instead of caching an empty list for a day. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  try {
    return combinedSitemapResponse(await companiesEntries());
  } catch {
    console.warn('Sitemap section companies failed; serving an empty list for a retry.');
    return combinedSitemapResponse([], { cache: 'no-store' });
  }
}
