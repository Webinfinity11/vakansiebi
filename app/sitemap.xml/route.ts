import {
  pagesEntries,
  searchesEntries,
  companiesEntries,
  vacanciesEntries,
} from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse } from '@/lib/sitemap';

/* Prerendered and then refreshed every hour: crawlers get a complete static file with the
   usual validators, and the database is read once per hour instead of once per request. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  const sections = await Promise.allSettled([
    searchesEntries(),
    vacanciesEntries(),
    companiesEntries(),
  ]);
  const names = ['searches', 'vacancies', 'companies'];
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
