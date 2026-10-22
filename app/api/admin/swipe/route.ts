import { apiError, requireAdmin } from '@/lib/server/auth';
import { db } from '@/lib/server/db';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const page = Math.min(
      100000,
      Math.max(
        0,
        Math.floor(Number(new URL(request.url).searchParams.get('page')) || 0),
      ),
    );
    const rows = (
      await db().query(
        `SELECT a.id, a.created_at "createdAt",
      a.candidate_name name, a.candidate_email email, a.candidate_phone phone,
      a.job_id "jobId", COALESCE(j.published->>'title',j.draft->>'title','ვაკანსია') title,
      a.recipient, a.status, a.cv_kind "cvKind", a.cv_file IS NOT NULL "hasFile",
      r.id "resumeId"
      FROM swipe_applications a JOIN jobs j ON j.id=a.job_id
      LEFT JOIN resumes r ON r.id=a.resume_id AND r.expires_at>now()
      ORDER BY a.created_at DESC,a.id DESC LIMIT 26 OFFSET $1`,
        [page * 25],
      )
    ).rows;
    return Response.json(
      { applications: rows.slice(0, 25), more: rows.length > 25 },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
