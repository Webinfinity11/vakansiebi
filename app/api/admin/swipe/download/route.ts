import { get } from '@vercel/blob';
import { z } from 'zod';
import { apiError, ApiError, requireAdmin } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { resumeDetail } from '@/lib/server/resumes';
import { renderCvPdf } from '@/lib/server/cv-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const id = z.uuid().parse(params.get('id'));
    const disposition = params.get('view') === '1' ? 'inline' : 'attachment';
    const headers = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="CV-${id}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    const row = (
      await db().query<{
        cv_file: string | null;
        cv_kind: string;
        resume_id: string | null;
      }>(
        'SELECT cv_file, cv_kind, resume_id FROM swipe_applications WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (!row) throw new ApiError('CV ვერ მოიძებნა', 404);
    if (!row.cv_file && row.cv_kind === 'jobx' && row.resume_id) {
      const cv = await resumeDetail(row.resume_id);
      if (!cv) throw new ApiError('CV ვერ მოიძებნა', 404);
      return new Response(Buffer.from(await renderCvPdf(cv)), { headers });
    }
    if (!row.cv_file) throw new ApiError('CV ვერ მოიძებნა', 404);
    let blob;
    try {
      blob = await get(row.cv_file, {
        access: 'private',
        useCache: false,
        abortSignal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new ApiError('CV დროებით მიუწვდომელია', 503);
    }
    if (!blob || blob.statusCode !== 200)
      throw new ApiError('CV ვერ მოიძებნა', 404);
    return new Response(blob.stream, {
      headers,
    });
  } catch (e) {
    const response = apiError(e);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}
