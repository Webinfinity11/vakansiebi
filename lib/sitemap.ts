export type SitemapEntry = { url: string; lastModified?: Date };

const lastmod = (date?: Date) =>
  date ? `<lastmod>${date.toISOString()}</lastmod>` : '';

/* The vacancy and company lists take seconds to build and change slowly, so the edge holds
   them for an hour and keeps serving the last copy for a day while it refreshes. A failed
   build is never held: the crawler retries and gets a fresh attempt. */
export const sitemapCacheControl =
  'public, s-maxage=3600, stale-while-revalidate=86400';

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const urlsetStart =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
const urlXml = (entry: SitemapEntry) =>
  `<url><loc>${xmlEscape(entry.url)}</loc>${lastmod(entry.lastModified)}</url>\n`;

/** A flat sitemap, truncated at the URL count and CDN response size limits.
 * The body is built in one piece rather than streamed: a streamed response is not stored by
 * the CDN, so every crawler fetch rebuilt the whole list from the database and took seconds.
 */
export function combinedSitemapResponse(
  entries: readonly SitemapEntry[],
  options: { cache?: string } = {},
) {
  const unique = [
    ...new Map(entries.map((entry) => [entry.url, entry])).values(),
  ];
  if (unique.length > 50_000) {
    console.warn(`Sitemap truncated to 50000 URLs of ${unique.length}`);
    unique.length = 50_000;
  }
  const footer = '</urlset>\n';
  const encoder = new TextEncoder();
  let bytes = encoder.encode(urlsetStart + footer).byteLength;
  const fragments: string[] = [];
  for (const entry of unique) {
    const fragment = urlXml(entry);
    const size = encoder.encode(fragment).byteLength;
    if (bytes + size > 4 * 1024 * 1024) {
      console.warn(
        `Sitemap truncated to ${fragments.length} URLs of ${unique.length} at the 4 MiB limit`,
      );
      break;
    }
    fragments.push(fragment);
    bytes += size;
  }
  const body = urlsetStart + fragments.join('') + footer;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': options.cache ?? sitemapCacheControl,
      'CDN-Cache-Control': options.cache ?? sitemapCacheControl,
      'Vercel-CDN-Cache-Control': options.cache ?? sitemapCacheControl,
    },
  });
}

const sitemapIndexStart =
  '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
const sitemapXml = (entry: SitemapEntry) =>
  `<sitemap><loc>${xmlEscape(entry.url)}</loc>${lastmod(entry.lastModified)}</sitemap>\n`;

/** The four leaf sitemaps every index address points at: split so a crawler can revisit
 * the highly perishable job list on its own schedule, separately from the stable ones. */
export function sitemapLeaves(base: string) {
  return ['pages', 'categories', 'companies', 'jobs'].map((name) => ({
    url: `${base}/sitemap-${name}.xml`,
  }));
}

export function sitemapIndexResponse(entries: readonly SitemapEntry[]) {
  const body =
    sitemapIndexStart + entries.map(sitemapXml).join('') + '</sitemapindex>\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': sitemapCacheControl,
    },
  });
}

/** Bound the entire leaf (including pool acquisition), not just each SQL query.
 * Failures are never cached at the edge; a warm instance can still serve its last
 * complete list. A cold failure leaves the other index sections available. */
export function createSitemapHandler(
  load: () => Promise<SitemapEntry[]>,
  timeoutMs = 25_000,
  /* What a cold instance serves when the census runs out of time. An empty
     urlset is a valid document saying "this section holds nothing", which is a
     worse answer than a short, certain list: production served exactly that to
     every crawl on 2026-09-23 until this fallback existed. */
  floor: () => SitemapEntry[] = () => [],
  name = 'sitemap',
) {
  let lastGood: SitemapEntry[] = [];
  return async function GET() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    try {
      const entries = await Promise.race([
        Promise.resolve().then(load),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Sitemap deadline exceeded')),
            timeoutMs,
          );
        }),
      ]);
      if (!entries.length)
        throw new Error('Sitemap generation returned no URLs');
      lastGood = entries;
      return combinedSitemapResponse(entries);
    } catch (error) {
      const fallback = lastGood.length ? lastGood : floor();
      console.warn('Sitemap generation failed', {
        name,
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
        urls: fallback.length,
        source: lastGood.length
          ? 'memory'
          : fallback.length
            ? 'curated'
            : 'unavailable',
      });
      if (fallback.length)
        return combinedSitemapResponse(fallback, { cache: 'no-store' });
      // An unavailable catalogue must never look like a successfully empty one.
      return new Response('Sitemap temporarily unavailable. Please retry.', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'CDN-Cache-Control': 'no-store',
          'Vercel-CDN-Cache-Control': 'no-store',
          'Retry-After': '300',
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };
}
