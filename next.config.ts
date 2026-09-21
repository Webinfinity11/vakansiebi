import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  /* Next streams metadata for anything it believes executes JavaScript, and a
     streamed response has already sent 200 by the time notFound() is reached: a
     vacancy that no longer exists answered a crawler with 200 and a "page is
     gone" body, which is the definition of a soft 404 — and this catalogue
     retires thousands of URLs a month. Googlebot is missing from the default
     list (it matches "X-Google" and "Google-X", not "Googlebot"), so the list is
     the shipped one with Googlebot in front: crawlers get a blocking render and
     a real status, readers keep the streamed one. */
  htmlLimitedBots:
    /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  async redirects() {
    return [
      {
        source: '/sitemap-index.xml',
        destination: '/sitemap.xml',
        statusCode: 301,
      },
      {
        source: '/sitemap-searches.xml',
        destination: '/sitemap.xml',
        statusCode: 301,
      },
      {
        source: '/vacancies/sitemap.xml',
        destination: '/sitemap.xml',
        statusCode: 301,
      },
      {
        source: '/companies/sitemap.xml',
        destination: '/sitemap.xml',
        statusCode: 301,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/api/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
        ],
      },
      {
        source: '/invoices/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ];
  },
};
export default config;
