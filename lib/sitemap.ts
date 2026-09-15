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
