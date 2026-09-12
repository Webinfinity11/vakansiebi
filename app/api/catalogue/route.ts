import { db } from '@/lib/server/db';
import { searchPlan } from '@/lib/server/search-plan';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    // The same visibility, tender exclusion and duplicate folding as /api/jobs,
    // so the catalogue total is the number a visitor can actually page through.
    const plan = searchPlan(new URLSearchParams(), false, { grouped: true });
    const { rows } = await db().query(
      `${plan.cte}, visible AS MATERIALIZED (SELECT j.id,j.published,j.group_key FROM searchable j WHERE ${plan.where})
    SELECT (SELECT count(*)::int FROM visible) total,
      COALESCE((SELECT jsonb_agg(c) FROM (SELECT published->>'category' name,count(*)::int count FROM visible GROUP BY 1 ORDER BY 2 DESC) c),'[]'::jsonb) categories,
      COALESCE((SELECT jsonb_agg(c) FROM (SELECT s.name,count(DISTINCT v.id)::int count FROM visible v JOIN members m ON m.group_key=v.group_key JOIN source_items i ON i.job_id=m.id JOIN sources s ON s.id=i.source_id WHERE NOT s.retired GROUP BY s.name ORDER BY 2 DESC) c),'[]'::jsonb) sources`,
      plan.args,
    );
    return Response.json(rows[0], {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180',
      },
    });
  } catch {
    return Response.json(
      { error: 'მონაცემები დროებით მიუწვდომელია' },
      { status: 503 },
    );
  }
}
