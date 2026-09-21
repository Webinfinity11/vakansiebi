import { vacanciesEntries } from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse } from '@/lib/sitemap';

/* Only currently public vacancies, so a listing drops out again on its own once it comes
   down — nothing marks it for removal separately. Served with no-store on a database failure
   so the crawler retries soon instead of caching an empty list for a day. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  try {
    return combinedSitemapResponse(await vacanciesEntries());
  } catch {
    console.warn('Sitemap section jobs failed; serving an empty list for a retry.');
    return combinedSitemapResponse([], { cache: 'no-store' });
  }
}
