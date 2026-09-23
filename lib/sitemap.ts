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
  timeoutMs = 9_000,
) {
  let lastGood: SitemapEntry[] = [];
  return async function GET() {
    let timer: ReturnType<typeof setTimeout> | undefined;
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
      lastGood = entries;
      return combinedSitemapResponse(entries);
    } catch {
      console.warn(
        'Sitemap section unavailable; serving the last list for a retry.',
      );
      return combinedSitemapResponse(lastGood, { cache: 'no-store' });
    } finally {
      clearTimeout(timer);
    }
  };
}
