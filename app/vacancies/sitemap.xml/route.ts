import { db } from '@/lib/server/db';
import { searchPlan } from '@/lib/server/search-plan';
import { siteUrl } from '@/lib/seo';
import { sitemapUnavailable, urlsetResponse } from '@/lib/sitemap';

// Built on request and held at the edge (see sitemapCacheControl), not prerendered at build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
    const result = await db().query<{ id: string }>(
      `${plan.cte} SELECT j.id FROM searchable j WHERE ${plan.where} ORDER BY ${plan.ordering},j.id LIMIT 45000`,
      plan.args,
    );
    return urlsetResponse(
      result.rows.map(({ id }) => `${siteUrl}/vacancies/${id}`),
    );
  } catch {
    return sitemapUnavailable();
  }
}
