import type { MetadataRoute } from 'next';
import { employerPages } from '@/lib/server/employers';
import { siteUrl } from '@/lib/seo';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const employers = await employerPages();
  return [...employers.bySlug.keys()].slice(0, 4999).map((slug) => ({
    url: `${siteUrl}/companies/${encodeURIComponent(slug)}`,
  }));
}
