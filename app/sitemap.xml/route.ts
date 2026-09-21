import { newest, publicVacancyDatesOrLast } from '@/lib/server/sitemap-data';
import { sitemapIndexResponse } from '@/lib/sitemap';

// Refresh at the CDN without rebuilding the website when vacancies change.
export const dynamic = 'force-dynamic';

/* The submitted address is a sitemap index, not one large file: a crawler reads a few hundred
   bytes and then fetches each section on its own schedule. The vacancy and company sections
   carry the newest publication date so a recrawl is requested only when something changed. */
export async function GET() {
  try {
    const changed = newest(
      (await publicVacancyDatesOrLast()).flatMap(
        ({ lastModified }) => lastModified || [],
      ),
    );
    return sitemapIndexResponse(
      changed
        ? {
            '/vacancies/sitemap.xml': changed,
            '/companies/sitemap.xml': changed,
          }
        : {},
    );
  } catch {
    // Discovery stays available during a database outage; the dates return on the next refresh.
    console.warn('Sitemap dates unavailable; serving the plain section index.');
    const response = sitemapIndexResponse();
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
