import type { MetadataRoute } from 'next';
import { db } from '@/lib/server/db';
import { searchPlan } from '@/lib/server/search-plan';
import { siteUrl } from '@/lib/seo';

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
  const result = await db().query<{ id: string }>(
    `${plan.cte} SELECT j.id FROM searchable j WHERE ${plan.where} ORDER BY ${plan.ordering},j.id LIMIT 45000`,
    plan.args,
  );
  return result.rows.map(({ id }) => ({ url: `${siteUrl}/vacancies/${id}` }));
}
