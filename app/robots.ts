import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';
import { sitemapLeaves } from '@/lib/sitemap';

// Every one of these is already covered by the User-agent: * block below — an
// AI crawler with no name of its own here still gets Allow: /. Naming them is
// for the crawlers (and the audits reading this file) that only trust a rule
// addressed to them by name, not one they have to infer from the wildcard.
const aiBots = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
  'Applebot-Extended',
  'meta-externalagent',
  'Bytespider',
];

export default function robots(): MetadataRoute.Robots {
  const open = { allow: '/', disallow: ['/admin', '/api/'] };
  return {
    rules: [
      { userAgent: '*', ...open },
      { userAgent: aiBots, ...open },
    ],
    /* The index first, then every leaf on its own line. A crawler that cannot
       process the index — which is what Search Console reported for days — can
       still reach each section directly. Repetition costs nothing here. */
    sitemap: [
      `${siteUrl}/sitemap.xml`,
      ...sitemapLeaves(siteUrl).map((leaf) => leaf.url),
    ],
  };
}
