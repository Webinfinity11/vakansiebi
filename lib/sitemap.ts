import { siteUrl } from './seo';

export const sitemapPaths = [
  '/sitemap-pages.xml',
  '/sitemap-searches.xml',
  '/vacancies/sitemap.xml',
  '/companies/sitemap.xml',
] as const;

export type SitemapEntry = { url: string; lastModified?: Date };

const lastmod = (date?: Date) =>
  date ? `<lastmod>${date.toISOString()}</lastmod>` : '';

/* The index still answers when the dates cannot be read: crawlers can always discover each
   sitemap, and the dates return on the next refresh. */
export function sitemapIndexResponse(
  modified: Partial<Record<(typeof sitemapPaths)[number], Date>> = {},
) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths.map((path) => `  <sitemap><loc>${siteUrl}${path}</loc>${lastmod(modified[path])}</sitemap>`).join('\n')}\n</sitemapindex>\n`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': sitemapCacheControl,
      },
    },
  );
}

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

/** A flat sitemap, with the existing index as a fallback beyond protocol limits.
 * Stream the XML so the growing catalogue does not hit Vercel's buffered body limit.
 * All data is loaded before opening the stream so database failures still return 503.
 */
export function combinedSitemapResponse(entries: readonly SitemapEntry[]) {
  const unique = [
    ...new Map(entries.map((entry) => [entry.url, entry])).values(),
  ];
  if (unique.length > 50_000) return sitemapIndexResponse();
  const chunks = [urlsetStart, ...unique.map(urlXml), '</urlset>\n'];
  const encoder = new TextEncoder();
  const bytes = chunks.reduce(
    (total, chunk) => total + encoder.encode(chunk).byteLength,
    0,
  );
  if (bytes > 50 * 1024 * 1024) return sitemapIndexResponse();
  let position = 0;
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (position >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(
          encoder.encode(chunks.slice(position, position + 100).join('')),
        );
        position += 100;
      },
    }),
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': sitemapCacheControl,
      },
    },
  );
}

export function urlsetResponse(entries: readonly SitemapEntry[]) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((e) => `<url><loc>${xmlEscape(e.url)}</loc>${lastmod(e.lastModified)}</url>`).join('\n')}\n</urlset>\n`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': sitemapCacheControl,
      },
    },
  );
}

export function sitemapUnavailable() {
  return new Response('Sitemap temporarily unavailable', {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'Retry-After': '300' },
  });
}
