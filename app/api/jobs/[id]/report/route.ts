import { z } from 'zod';
import { apiError, ApiError, checkOrigin, readBody } from '@/lib/server/auth';
import { transaction } from '@/lib/server/db';
import { clientKey, rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reportSchema = z.object({
  reason: z.enum(['expired', 'wrong', 'duplicate', 'other']),
  note: z
    .string()
    .max(300)
    .refine((note) => !note.includes('\u0000'))
    .trim()
    .optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    if (!req.headers.get('content-type')?.startsWith('application/json'))
      throw new ApiError('არასწორი მოთხოვნა', 415);
    const id = z
      .uuid()
      .parse((await params).id)
      .toLowerCase();
    const data = reportSchema.parse(await readBody(req));
    // Address-based counters live only in memory; no identity goes into reports.
    const limit = rateLimit(`report:${clientKey(req)}:${id}`, {
      limit: 3,
      windowMs: 3600000,
    });
    if (!limit.allowed)
      return Response.json(
        { error: 'ძალიან ბევრი მცდელობაა. სცადე მოგვიანებით.' },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    const alreadyReceived = await transaction(async (client) => {
      // Serialize reports for this vacancy so concurrent requests cannot both insert.
      const job = await client.query(
        'SELECT id FROM jobs WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!job.rowCount) throw new ApiError('ვაკანსია ვერ მოიძებნა', 404);
      const duplicate = await client.query(
        `SELECT id FROM job_reports
         WHERE job_id=$1 AND reason=$2 AND resolved_at IS NULL
           AND created_at >= now() - interval '24 hours'
         LIMIT 1`,
        [id, data.reason],
      );
      if (duplicate.rowCount) return true;
      await client.query(
        'INSERT INTO job_reports(job_id,reason,note) VALUES($1,$2,$3)',
        [id, data.reason, data.note || null],
      );
      return false;
    });
    return Response.json(
      {
        received: true,
        alreadyReceived,
        message: alreadyReceived ? 'უკვე მიღებულია' : 'მიღებულია',
      },
      {
        status: alreadyReceived ? 200 : 201,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
