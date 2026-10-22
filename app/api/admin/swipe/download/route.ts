import { get } from '@vercel/blob';
import { z } from 'zod';
import { apiError, ApiError, requireAdmin } from '@/lib/server/auth';
import { db } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const id = z.uuid().parse(new URL(request.url).searchParams.get('id'));
    const row = (
      await db().query<{ cv_file: string | null }>(
        "SELECT cv_file FROM swipe_applications WHERE id=$1 AND cv_kind='upload'",
        [id],
      )
    ).rows[0];
    if (!row?.cv_file) throw new ApiError('CV ვერ მოიძებნა', 404);
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
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CV-${id}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    const response = apiError(e);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
}
