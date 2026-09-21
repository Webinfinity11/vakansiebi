import {
  pagesEntries,
  searchesEntries,
  companiesEntries,
} from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse } from '@/lib/sitemap';

/* Prerendered and then refreshed every hour: crawlers get a complete static file with the
   usual validators, and the database is read once per hour instead of once per request.
   Vacancy detail pages are deliberately left out: a listing lives about a month and then
   comes down, so submitting it would just churn the sitemap with URLs that go stale within
   weeks. Company and search pages are stable enough to be worth submitting. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  const sections = await Promise.allSettled([
    searchesEntries(),
    companiesEntries(),
  ]);
  const names = ['searches', 'companies'];
  const entries = pagesEntries();
  let failed = false;
  sections.forEach((section, index) => {
    if (section.status === 'fulfilled') {
      entries.push(...section.value);
    } else {
      failed = true;
      console.warn(`Sitemap section ${names[index]} failed; serving a partial URL list.`);
    }
  });
  // Retry the complete list on the next request when any section failed.
  return combinedSitemapResponse(entries, failed ? { cache: 'no-store' } : undefined);
}
