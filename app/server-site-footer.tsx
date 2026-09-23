import { landingCounts } from '@/lib/server/sitemap-data';
import { SearchDirectoryProvider } from './search-directory-context';
import { SiteFooter } from './site-footer';

/** Start the snapshot read without holding up the page; only the directory suspends. */
export function ServerSiteFooter() {
  const rows = landingCounts().catch(() => null);
  return (
    <SearchDirectoryProvider rows={rows}>
      <SiteFooter />
    </SearchDirectoryProvider>
  );
}
