import {
  pagesEntries,
  searchesEntries,
  companiesEntries,
  vacanciesEntries,
} from '@/lib/server/sitemap-entries';
import { combinedSitemapResponse } from '@/lib/sitemap';

/* The same list as /sitemap.xml under a second address. Search Console keeps its state per
   submitted URL, so an address it has never seen gets a fresh fetch rather than whatever
   record is stuck against the old one. Both addresses serve identical content. */
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  const sections = await Promise.allSettled([
    searchesEntries(),
    vacanciesEntries(),
    companiesEntries(),
  ]);
  const entries = pagesEntries();
  let failed = false;
  for (const section of sections) {
    if (section.status === 'fulfilled') entries.push(...section.value);
    else failed = true;
  }
  return combinedSitemapResponse(
    entries,
    failed ? { cache: 'no-store' } : undefined,
  );
}
