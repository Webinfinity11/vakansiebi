import { z } from 'zod';
import { db } from '@/lib/server/db';
import {
  apiError,
  ApiError,
  requireAdmin,
  checkOrigin,
  readBody,
} from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const open = new URL(req.url).searchParams.get('open') === '1';
    const reports = (
      await db().query(
        `SELECT r.id::text, r.job_id, r.reason, r.note, r.created_at, r.resolved_at,
                COALESCE(j.published->>'title', j.draft->>'title', 'ვაკანსია') AS title,
                '/vacancies/' || j.id::text AS url
         FROM job_reports r JOIN jobs j ON j.id=r.job_id
         WHERE (NOT $1::boolean OR r.resolved_at IS NULL)
         ORDER BY r.created_at ASC, r.id ASC`,
        [open],
      )
    ).rows;
    return Response.json(
      { reports },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    const data = z
      .object({
        id: z
          .union([
            z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
            z.string().regex(/^[1-9]\d{0,18}$/),
          ])
          .transform(String)
          .refine((id) => BigInt(id) <= BigInt('9223372036854775807')),
        resolved: z.literal(true),
      })
      .parse(await readBody(req));
    const result = await db().query(
      `UPDATE job_reports SET resolved_at=COALESCE(resolved_at, now())
       WHERE id=$1 RETURNING id::text, resolved_at`,
      [data.id],
    );
    if (!result.rowCount) throw new ApiError('შეტყობინება ვერ მოიძებნა', 404);
    return Response.json(
      { ok: true, report: result.rows[0], message: 'გადაწყვეტილია' },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
