import { db } from '@/lib/server/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { rows } = await db().query(`WITH visible AS (
      SELECT j.id,j.published FROM jobs j WHERE j.status='published' AND j.published IS NOT NULL
      AND (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline'>=to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD'))
      AND EXISTS(SELECT 1 FROM source_items i JOIN sources s ON s.id=i.source_id WHERE i.job_id=j.id AND NOT s.retired)
    ) SELECT (SELECT count(*)::int FROM visible) total,
      COALESCE((SELECT jsonb_agg(c) FROM (SELECT published->>'category' name,count(*)::int count FROM visible GROUP BY 1 ORDER BY 2 DESC) c),'[]'::jsonb) categories,
      COALESCE((SELECT jsonb_agg(c) FROM (SELECT s.name,count(DISTINCT v.id)::int count FROM visible v JOIN source_items i ON i.job_id=v.id JOIN sources s ON s.id=i.source_id WHERE NOT s.retired GROUP BY s.name ORDER BY 2 DESC) c),'[]'::jsonb) sources`);
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
