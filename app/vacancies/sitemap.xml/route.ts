import { publicVacancyDates } from '@/lib/server/sitemap-data';
import { siteUrl } from '@/lib/seo';
import { sitemapUnavailable, urlsetResponse } from '@/lib/sitemap';

// Built on request and held at the edge (see sitemapCacheControl), not prerendered at build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const vacancies = await publicVacancyDates();
    return urlsetResponse(
      vacancies.map(({ id, lastModified }) => ({
        url: `${siteUrl}/vacancies/${id}`,
        lastModified,
      })),
    );
  } catch {
    return sitemapUnavailable();
  }
}
