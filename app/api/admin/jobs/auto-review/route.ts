import { z } from 'zod';
import { ApiError, apiError, checkOrigin, readBody, requireAdmin } from '@/lib/server/auth';
import { transaction } from '@/lib/server/db';

export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    const { id } = z.object({ id: z.uuid() }).parse(await readBody(req));
    await transaction(async c => {
      const job = (await c.query('SELECT auto_published_at,auto_publish_reviewed_at FROM jobs WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!job?.auto_published_at) throw new ApiError('ავტომატურად გამოქვეყნებული ვაკანსია ვერ მოიძებნა.', 404);
      if (job.auto_publish_reviewed_at) return;
      await c.query('UPDATE jobs SET auto_publish_reviewed_at=now() WHERE id=$1', [id]);
      await c.query("INSERT INTO audit_log(job_id,action,actor) VALUES($1,'auto_publish.reviewed','admin')", [id]);
    });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}
