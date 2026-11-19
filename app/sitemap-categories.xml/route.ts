import { searchesEntries } from '@/lib/server/sitemap-entries';
import { createSitemapHandler } from '@/lib/sitemap';

// The CDN owns the successful response's TTL. Avoid storing a failed snapshot read
// in Next's static route cache for an hour despite its no-store response.
export const dynamic = 'force-dynamic';

// Without fresh counts the curated links can include pages that return noindex.
// Use a new handler per request so a stale snapshot cannot serve old eligibility.
export async function GET() {
  return createSitemapHandler(
    searchesEntries,
    3_000,
    undefined,
    'categories',
  )();
}
