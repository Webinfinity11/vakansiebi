import { z } from 'zod';
import { db } from '@/lib/server/db';
import {
  apiError,
  requireAdmin,
  checkOrigin,
  readBody,
  ApiError,
} from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireAdmin();
    const sources = (
      await db().query(
        `SELECT s.*,(SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.raw IS NOT NULL) imported,(SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.raw IS NULL) queued FROM sources s ORDER BY s.id`,
      )
    ).rows;
    const runs = (
      await db().query(
        'SELECT * FROM source_runs ORDER BY started_at DESC LIMIT 20',
      )
    ).rows;
    return Response.json({ sources, runs, notificationsEnabled: false });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    const data = z
      .object({
        id: z.enum(['hr', 'samushao', 'jobs']),
        action: z.enum(['run', 'configure']),
        enabled: z.boolean().optional(),
        autoEnabled: z.boolean().optional(),
        intervalMinutes: z.number().int().min(15).max(1440).optional(),
      })
      .parse(await readBody(req));
    if (data.action === 'run') {
      const r = await db().query(
        'UPDATE sources SET requested_at=COALESCE(requested_at,now()) WHERE id=$1 AND enabled=true RETURNING id',
        [data.id],
      );
      if (!r.rowCount) throw new ApiError('ჯერ ჩართე წყარო');
      return Response.json({
        ok: true,
        message: 'შემოწმება რიგშია. ფონური პროცესი მალე დაიწყებს.',
      });
    }
    await db().query(
      'UPDATE sources SET enabled=COALESCE($2,enabled),auto_enabled=COALESCE($3,auto_enabled),interval_minutes=COALESCE($4,interval_minutes) WHERE id=$1',
      [data.id, data.enabled, data.autoEnabled, data.intervalMinutes],
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
