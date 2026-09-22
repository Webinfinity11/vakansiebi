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
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    if (id) {
      const cv = await resumeDetail(id);
      if (!cv) throw new ApiError('რეზიუმე ვერ მოიძებნა', 404);
      return Response.json({ cv }, { headers });
    }
    const page = Math.min(
      100000,
      Math.max(0, Math.floor(Number(params.get('page')) || 0)),
    );
    const rows = (
      await db().query(
        'SELECT id,created_at,updated_at,expires_at,cv FROM resumes WHERE expires_at>now() ORDER BY created_at DESC,id LIMIT 26 OFFSET $1',
        [page * 25],
      )
    ).rows;
    return Response.json(
      {
        more: rows.length > 25,
        resumes: rows
          .slice(0, 25)
          .map((row) => ({
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            expiresAt: row.expires_at,
            language: row.cv.language,
            template: row.cv.template,
            completeness: cvProgress({ ...row.cv, photo: '' } as Cv),
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
