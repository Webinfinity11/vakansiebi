import { searchesEntries } from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse } from '@/lib/sitemap';

/* The curated category/city/trait/role landing pages — the same short list the pages
   themselves agree is worth indexing (see lib/seo-landing.ts). Served with no-store on a
   database failure so the crawler retries soon instead of caching an empty list for a day. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  try {
    return combinedSitemapResponse(await searchesEntries());
  } catch {
    console.warn('Sitemap section categories failed; serving an empty list for a retry.');
    return combinedSitemapResponse([], { cache: 'no-store' });
  }
}
