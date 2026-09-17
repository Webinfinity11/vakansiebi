import { landingCounts } from '@/lib/server/sitemap-data';
import { landingFor, landingPath } from '@/lib/seo-landing';
import { siteUrl } from '@/lib/seo';
import { sitemapUnavailable, urlsetResponse } from '@/lib/sitemap';

// Built on request and held at the edge (see sitemapCacheControl), not prerendered at build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await landingCounts();
    const paths = rows
      .map(({ category, city, trait }) =>
        landingPath({ category, city, trait }),
      )
      // The same guard the page itself uses, so a listed address is an indexable one.
      .filter(
        (path) => !!landingFor(new URLSearchParams(path.split('?')[1] || '')),
      );
    return urlsetResponse(
      [...new Set(paths)].sort().map((path) => ({ url: siteUrl + path })),
    );
  } catch {
    return sitemapUnavailable();
  }
}
