import { companiesEntries } from '@/lib/server/sitemap-entries';
import { sitemapUnavailable, urlsetResponse } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return urlsetResponse(await companiesEntries());
  } catch {
    return sitemapUnavailable();
  }
}
