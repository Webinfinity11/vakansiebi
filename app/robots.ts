import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

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
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
