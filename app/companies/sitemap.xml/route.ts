import { employerPages } from '@/lib/server/employers';
import { newest, publicVacancyDatesOrLast } from '@/lib/server/sitemap-data';
import { siteUrl } from '@/lib/seo';
import { sitemapUnavailable, urlsetResponse } from '@/lib/sitemap';

// Built on request and held at the edge (see sitemapCacheControl), not prerendered at build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [employers, vacancies] = await Promise.all([
      employerPages(),
      publicVacancyDatesOrLast(),
    ]);
    // A company page changes when one of its vacancies does.
    const changed = new Map(vacancies.map((v) => [v.id, v.lastModified]));
    return urlsetResponse(
      [...employers.bySlug.values()].slice(0, 4999).map((page) => ({
        url: `${siteUrl}/companies/${encodeURIComponent(page.slug)}`,
        lastModified: newest(
          page.jobIds.flatMap((id) => changed.get(id) || []),
        ),
      })),
    );
  } catch {
    return sitemapUnavailable();
  }
}
