import { siteUrl } from './seo';

export const sitemapPaths = [
  '/sitemap-pages.xml',
  '/vacancies/sitemap.xml',
  '/companies/sitemap.xml',
] as const;

// The index has no database dependency: crawlers can discover each independent
// sitemap even while a vacancy or employer snapshot is being regenerated.
export function sitemapIndexResponse() {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPaths.map((path) => `  <sitemap><loc>${siteUrl}${path}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
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

export function urlsetResponse(urls: readonly string[]) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `<url><loc>${xmlEscape(url)}</loc></url>`).join('\n')}\n</urlset>\n`,
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
