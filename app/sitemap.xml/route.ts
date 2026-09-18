import {
  pagesEntries,
  searchesEntries,
  companiesEntries,
} from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse, sitemapUnavailable } from '@/lib/sitemap';

// Refresh at the CDN without rebuilding the website when vacancies change.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sections = await Promise.all([searchesEntries(), companiesEntries()]);
    return combinedSitemapResponse([...pagesEntries(), ...sections.flat()]);
  } catch {
    return sitemapUnavailable();
  }
}
