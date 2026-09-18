import { pagesEntries } from '@/lib/server/sitemap-entries';
import { urlsetResponse } from '@/lib/sitemap';

export const dynamic = 'force-static';

export function GET() {
  return urlsetResponse(pagesEntries());
}
