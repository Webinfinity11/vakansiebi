import { z } from 'zod';
import {
  apiError,
  ApiError,
  requireAdmin,
  checkOrigin,
  readBody,
} from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { resumeDetail } from '@/lib/server/resumes';
import { cvProgress, type Cv } from '@/lib/cv';

export const dynamic = 'force-dynamic';
/* One stored CV with a missing field must not take the whole list down with it. */
function progress(cv: Cv) {
  try {
    return cvProgress({ ...cv, photo: '' });
  } catch {
    return 0;
  }
}
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    if (id) {
      const cv = await resumeDetail(id);
      if (!cv) throw new ApiError('რეზიუმე ვერ მოიძებნა', 404);
      // What this CV's holder did on our vacancies, newest first.
      const activity = (
        await db().query(
          `SELECT c.job_id::text "jobId", COALESCE(j.published->>'title', j.draft->>'title','') title,
             COALESCE(j.published->>'company', j.draft->>'company','') company,
             c.kind, c.presses, c.first_at "firstAt", c.last_at "lastAt"
           FROM resume_contacts c JOIN jobs j ON j.id=c.job_id
           WHERE c.resume_id=$1 ORDER BY c.last_at DESC LIMIT 200`,
          [id],
        )
      ).rows;
      return Response.json({ cv, activity }, { headers });
    }
    const page = Math.min(
      100000,
      Math.max(0, Math.floor(Number(params.get('page')) || 0)),
    );
    const rows = (
      await db().query(
        `SELECT r.id,r.created_at,r.updated_at,r.expires_at,r.cv,
           (SELECT count(DISTINCT c.job_id)::int FROM resume_contacts c WHERE c.resume_id=r.id) contacted
         FROM resumes r WHERE r.expires_at>now() ORDER BY r.created_at DESC,r.id LIMIT 26 OFFSET $1`,
        [page * 25],
      )
    ).rows;
    return Response.json(
      {
        more: rows.length > 25,
        resumes: rows.slice(0, 25).map((row) => ({
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          expiresAt: row.expires_at,
          // A name and a role tell saved CVs apart; both are trimmed and may be empty.
          fullName: String(row.cv.fullName ?? '')
            .trim()
            .slice(0, 120),
          title: String(row.cv.title ?? '')
            .trim()
            .slice(0, 120),
          language: row.cv.language,
          template: row.cv.template,
          completeness: progress(row.cv),
          contacted: row.contacted,
        })),
      },
      { headers },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    checkOrigin(request);
    const { id } = z.object({ id: z.uuid() }).parse(await readBody(request));
    await db().query('DELETE FROM resumes WHERE id=$1', [id]);
    return Response.json({ ok: true }, { headers });
  } catch (e) {
    return apiError(e);
  }
}
