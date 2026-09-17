import { publicVacancyDatesOrLast } from '@/lib/server/sitemap-data';
import { siteUrl } from '@/lib/seo';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { sitemapUnavailable, urlsetResponse } from '@/lib/sitemap';

// Built on request and held at the edge (see sitemapCacheControl), not prerendered at build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const vacancies = await publicVacancyDatesOrLast();
    return urlsetResponse(
      vacancies.map(({ id, title, lastModified }) => ({
        url: siteUrl + vacancyPath({ id, title }),
        lastModified,
      })),
    );
  } catch {
    return sitemapUnavailable();
  }
}
