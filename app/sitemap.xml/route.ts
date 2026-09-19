import {
  pagesEntries,
  searchesEntries,
  companiesEntries,
} from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse, sitemapIndexResponse } from '@/lib/sitemap';

// Refresh at the CDN without rebuilding the website when vacancies change.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sections = await Promise.all([searchesEntries(), companiesEntries()]);
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
