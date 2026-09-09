import { createHash } from 'node:crypto';
import { load } from 'cheerio';

export type DiscoverySource = 'hr' | 'jobs' | 'ss';
export type DiscoveryInfo = {
  /** Exact source-reported listing total. Null means the source did not expose one. */
  reportedTotal: number | null;
  pageSize: number | null;
  totalPages: number | null;
};
const limits = { pages: 1000, total: 1000000, budget: 50 };
function positive(value: unknown, max: number): number | null {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= max
    ? value
    : null;
}
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
function supported(source: DiscoverySource) {
  if (!['hr', 'jobs', 'ss'].includes(source))
    throw Error('Source has no active listing discovery');
}
/** Call on the canonical FIRST listing page: last-page item count is not a page size. */
export function readDiscoveryInfo(
  source: DiscoverySource,
  firstPageHtml: string,
): DiscoveryInfo {
  supported(source);
  const $ = load(firstPageHtml);
  let reportedTotal: number | null = null;
  let pageSize: number | null = null;
  let totalPages: number | null = null;
  if (source === 'hr') {
    const state = record(parseJson($('#ng-state').text()));
    for (const value of Object.values(state || {})) {
      const data = record(record(record(value)?.b)?.data);
      const announcements = record(data?.announcements);
      const total = positive(announcements?.totalCount, limits.total);
      const size = Array.isArray(announcements?.items)
        ? positive(announcements.items.length, 500)
        : null;
      if (total && size) {
        reportedTotal = total;
        pageSize = size;
        break;
      }
    }
  } else if (source === 'ss') {
    const props = record(record(parseJson($('#__NEXT_DATA__').text()))?.props);
    const pageProps = record(props?.pageProps);
    const result = record(record(pageProps?.searchInitData)?.result);
    reportedTotal = positive(result?.totalCount, limits.total);
    pageSize = Array.isArray(result?.items)
      ? positive(result.items.length, 500)
      : null;
  } else {
    // Jobs.ge's actual scroll controller declares the final page; links live in a commented pager.
    // Parse a numeric bound only. Never execute source JavaScript.
    $('script:not([src])').each((_, element) => {
      const script = $(element).text();
      if (!/loaded_page\s*\+\+/.test(script) || !/for_scroll=yes/.test(script))
        return;
      const last = positive(
        Number(script.match(/loaded_page\s*<\s*(\d+)\b/)?.[1]),
        limits.pages,
      );
      if (last) totalPages = Math.max(totalPages || 1, last);
    });
  }
  if (reportedTotal && pageSize && reportedTotal >= pageSize) {
    const pages = Math.ceil(reportedTotal / pageSize);
    totalPages = positive(pages, limits.pages);
  }
  return { reportedTotal, pageSize, totalPages };
}
/** Fixed approved listing routes; no source-supplied host, credentials, filters or offsite paths. */
export function discoveryListingUrl(source: DiscoverySource, page = 1): string {
  supported(source);
  if (!positive(page, limits.pages)) throw Error('Invalid discovery page');
  if (source === 'hr') return `https://www.hr.ge/search-posting?pg=${page}`;
  if (source === 'jobs') return `https://jobs.ge/ge/ads/?page=${page}`;
  return `https://jobs.ss.ge/ka/l/vacancies?page=${page}`;
}
/** Additional pages after the already fetched first page. Persist cursor only for pages actually fetched. */
export function planDiscoveryPages(
  source: DiscoverySource,
  info: DiscoveryInfo,
  cursor = 0,
  budget = 10,
) {
  supported(source);
  const last = positive(info.totalPages, limits.pages);
  const current = Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0;
  const count = positive(budget, limits.budget);
  if (!last || last < 2 || !count)
    return { urls: [] as string[], nextCursor: current };
  const pages = Math.min(count, last - 1);
  const urls = Array.from({ length: pages }, (_, i) =>
    discoveryListingUrl(source, 2 + ((current + i) % (last - 1))),
  );
  return { urls, nextCursor: current + pages };
}
export function listingFingerprint(
  links: readonly { externalId: string }[],
): string {
  const ids = [...new Set(links.map((link) => link.externalId))].sort();
  return createHash('sha256').update(JSON.stringify(ids)).digest('hex');
}
/** One guard per source/run. Feed page one first; repeated/empty pages should stop pagination without advancing cursor. */
export class DiscoveryPageGuard {
  private hashes = new Set<string>();
  accept(
    links: readonly { externalId: string }[],
  ): 'accepted' | 'repeated' | 'empty' {
    if (!links.length) return 'empty';
    const hash = listingFingerprint(links);
    if (this.hashes.has(hash)) return 'repeated';
    this.hashes.add(hash);
    return 'accepted';
  }
}
