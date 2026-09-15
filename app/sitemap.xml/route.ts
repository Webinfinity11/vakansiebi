import { datedSitemapIndex } from '@/lib/server/sitemap-index';

// Keep the already submitted URL available without a redirect.
// Built on request and held at the edge, so the section dates stay current.
export const dynamic = 'force-dynamic';
export const GET = datedSitemapIndex;
