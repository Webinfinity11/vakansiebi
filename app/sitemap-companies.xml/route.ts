import { persistentSitemap } from '@/lib/server/sitemap-cache';
import { companiesEntries } from '@/lib/server/sitemap-entries';
import { createSitemapHandler } from '@/lib/sitemap';

// The CDN owns the successful response's TTL. Avoid storing a failed census
// in Next's static route cache for an hour despite its no-store response.
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const GET = createSitemapHandler(
  persistentSitemap('companies', companiesEntries),
  25_000,
  undefined,
  'companies',
);
