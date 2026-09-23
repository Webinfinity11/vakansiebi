import { companiesEntries } from '@/lib/server/sitemap-entries';
import { createSitemapHandler } from '@/lib/sitemap';

// The CDN owns the successful response's TTL. Avoid storing a failed census
// in Next's static route cache for an hour despite its no-store response.
export const dynamic = 'force-dynamic';

export const GET = createSitemapHandler(companiesEntries);
