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
        `SELECT s.*,
        (SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id) discovered,
        (SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.quality_warning IS NOT NULL) quality_held,
        (SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.raw IS NOT NULL) imported,
        (SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.raw IS NULL AND (i.error IS NULL OR i.failures>0)) queued,
        (SELECT count(DISTINCT j.id)::int FROM source_items i JOIN jobs j ON j.id=i.job_id WHERE i.source_id=s.id AND j.status='published' AND (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline'>=to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD'))) published_count,
        (SELECT count(*)::int FROM source_discovery_pages p WHERE p.source_id=s.id AND p.observed_at>now()-interval '24 hours') observed_pages
        FROM sources s WHERE NOT s.retired ORDER BY s.id`,
      )
    ).rows;
    const runs = (
      await db().query(
        'SELECT r.* FROM source_runs r JOIN sources s ON s.id=r.source_id WHERE NOT s.retired ORDER BY r.started_at DESC LIMIT 20',
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
        id: z.enum(['hr', 'jobs', 'ss', 'hrgov']),
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
