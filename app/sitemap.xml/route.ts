import {
  pagesEntries,
  searchesEntries,
  companiesEntries,
  vacanciesEntries,
} from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse, sitemapIndexResponse } from '@/lib/sitemap';

/* Prerendered and then refreshed every hour: crawlers get a complete static file with the
   usual validators, and the database is read once per hour instead of once per request. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  try {
    const sections = await Promise.all([
      searchesEntries(),
      companiesEntries(),
      vacanciesEntries(),
    ]);
    return combinedSitemapResponse([...pagesEntries(), ...sections.flat()]);
  } catch {
    // Keep discovery available during a database outage. Do not cache this
    // fallback: the next request should retry the full, up-to-date URL list.
    console.warn('Main sitemap generation failed; serving the section index.');
    const response = sitemapIndexResponse();
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
