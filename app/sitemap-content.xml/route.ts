import { contentEntries } from '@/lib/server/content-sitemap';
import { persistentSitemap } from '@/lib/server/sitemap-cache';
import { createSitemapHandler } from '@/lib/sitemap';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export const GET = createSitemapHandler(
  persistentSitemap('content', contentEntries),
  25_000,
  undefined,
  'content',
);
