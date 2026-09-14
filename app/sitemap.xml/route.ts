import { db } from '@/lib/server/db';
import { searchPlan } from '@/lib/server/search-plan';
import { employerPages } from '@/lib/server/employers';
import { siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';
const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export async function GET() {
  const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
  const [result, employers] = await Promise.all([
    db().query(
      `${plan.cte} SELECT j.id FROM searchable j WHERE ${plan.where} ORDER BY ${plan.ordering},j.id LIMIT 45000`,
      plan.args,
    ),
    employerPages(),
  ]);
  const urls = [
    siteUrl + '/',
    ...result.rows.map((row) => `${siteUrl}/vacancies/${row.id}`),
    ...[...employers.bySlug.keys()]
      .slice(0, 4999)
      .map((slug) => `${siteUrl}/companies/${encodeURIComponent(slug)}`),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
      },
    },
  );
}
