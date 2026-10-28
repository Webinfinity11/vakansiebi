import { apiError, requireAdmin } from '@/lib/server/auth';
import { db } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

/* One candidate sends many CVs in a sitting. They are listed once, by e-mail, else by the
   phone's last nine digits (+995 or not); a record with neither stays on its own. */
const candidateKey = `COALESCE(NULLIF(lower(btrim(a.candidate_email)),''),
  NULLIF(right(regexp_replace(COALESCE(a.candidate_phone,''),'\\D','','g'),9),''), a.id::text)`;

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const page = Math.min(
      100000,
      Math.max(0, Math.floor(Number(params.get('page')) || 0)),
    );
    const q = (params.get('q') ?? '').trim().slice(0, 80);
    const pattern = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : '';
    const [list, summary] = await Promise.all([
      db().query(
        `WITH sent AS (
           SELECT a.*, ${candidateKey} k FROM swipe_applications a
            WHERE $2='' OR a.candidate_name ILIKE $2 OR a.candidate_email ILIKE $2 OR a.candidate_phone ILIKE $2
         )
         SELECT a.k "key", (array_agg(a.candidate_name ORDER BY a.created_at DESC))[1] name,
           (array_agg(a.candidate_email ORDER BY a.created_at DESC))[1] email,
           (array_agg(a.candidate_phone ORDER BY a.created_at DESC))[1] phone,
           count(*)::int sent, count(*) FILTER (WHERE a.status='failed')::int failed,
           max(a.created_at) "lastAt",
           (json_agg(json_build_object(
             'id',a.id,'createdAt',a.created_at,'jobId',a.job_id,
             'title',COALESCE(j.published->>'title',j.draft->>'title','ვაკანსია'),
             'recipient',a.recipient,'status',a.status,'cvKind',a.cv_kind,
             'hasFile',a.cv_file IS NOT NULL,'resumeId',r.id
           ) ORDER BY a.created_at DESC, a.id DESC)) applications
         FROM sent a JOIN jobs j ON j.id=a.job_id
         LEFT JOIN resumes r ON r.id=a.resume_id AND r.expires_at>now()
         GROUP BY a.k ORDER BY max(a.created_at) DESC, a.k LIMIT 26 OFFSET $1`,
        [page * 25, pattern],
      ),
      page || q
        ? null
        : db().query(
            `SELECT count(*)::int total,
               count(*) FILTER (WHERE a.created_at>now()-interval '7 days')::int week,
               count(DISTINCT ${candidateKey})::int people
             FROM swipe_applications a`,
          ),
    ]);
    const rows = list.rows;
    return Response.json(
      {
        candidates: rows.slice(0, 25),
        more: rows.length > 25,
        summary: summary?.rows[0] ?? null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
