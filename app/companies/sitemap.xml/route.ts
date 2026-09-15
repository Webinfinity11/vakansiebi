import { employerPages } from '@/lib/server/employers';
import { siteUrl } from '@/lib/seo';
import { sitemapUnavailable, urlsetResponse } from '@/lib/sitemap';

// Built on request and held at the edge (see sitemapCacheControl), not prerendered at build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const employers = await employerPages();
    return urlsetResponse(
      [...employers.bySlug.keys()]
        .slice(0, 4999)
        .map((slug) => `${siteUrl}/companies/${encodeURIComponent(slug)}`),
    );
  } catch {
    return sitemapUnavailable();
  }
}
