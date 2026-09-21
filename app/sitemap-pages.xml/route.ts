import { pagesEntries } from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse } from '@/lib/sitemap';

/* The handful of static pages. No database dependency, so this leaf can never fail. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  return combinedSitemapResponse(pagesEntries());
}
