import { datedSitemapIndex } from '@/lib/server/sitemap-index';

// Built on request and held at the edge, so the section dates stay current.
export const dynamic = 'force-dynamic';
export const GET = datedSitemapIndex;
