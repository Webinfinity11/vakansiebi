import { z } from 'zod';
import { db } from '@/lib/server/db';
import { githubScraperStatus } from '@/lib/server/scraper-github';
import { wakeScraper } from '@/lib/server/scraper-control';
import {
  apiError,
  requireAdmin,
  checkOrigin,
  readBody,
  ApiError,
} from '@/lib/server/auth';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await requireAdmin();
    const sources = (
      await db().query(
        `SELECT s.*,
        (SELECT row_to_json(r) FROM source_runs r WHERE r.source_id=s.id ORDER BY r.started_at DESC LIMIT 1) latest_run,
        (SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.refresh_requested_at IS NOT NULL AND (i.refresh_completed_at IS NULL OR i.refresh_requested_at>i.refresh_completed_at)) refresh_pending,
        (SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.error IS NOT NULL AND i.refresh_requested_at IS NOT NULL AND (i.refresh_completed_at IS NULL OR i.refresh_requested_at>i.refresh_completed_at)) refresh_retrying,
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
    return Response.json({
      sources,
      runs,
      github: await githubScraperStatus(),
      notificationsEnabled: false,
      observedAt: new Date().toISOString(),
    });
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
        id: z.enum(['hr', 'jobs', 'ss', 'hrgov', 'all']),
        action: z.enum(['run', 'configure', 'retry']),
        enabled: z.boolean().optional(),
        autoEnabled: z.boolean().optional(),
        intervalMinutes: z.number().int().min(30).max(1440).optional(),
        autoPublish: z.boolean().optional(),
      })
      .parse(await readBody(req));
    if (data.action === 'run' || data.action === 'retry') {
      if (data.action === 'retry') {
        await db().query(
          `UPDATE source_items i SET next_check_at=now() FROM sources s
           WHERE s.id=i.source_id AND s.enabled AND NOT s.retired AND ($1='all' OR s.id=$1)
           AND i.refresh_requested_at IS NOT NULL AND (i.refresh_completed_at IS NULL OR i.refresh_requested_at>i.refresh_completed_at)`,
          [data.id],
        );
      } else {
        const r = await db().query(
          "UPDATE sources SET requested_at=COALESCE(requested_at,now()) WHERE ($1='all' OR id=$1) AND enabled AND NOT retired RETURNING id",
          [data.id],
        );
        if (!r.rowCount) throw new ApiError('ჯერ ჩართე წყარო');
      }
      const result = await wakeScraper();
      return Response.json({
        ok: true,
        message: result.dispatched
          ? 'GitHub-ზე გაშვება მოთხოვნილია. პროგრესი აქ ავტომატურად განახლდება.'
          : result.reason === 'already_requested'
            ? 'მოთხოვნა შენახულია. GitHub-ზე გაშვება უკვე მოთხოვნილია; თუ მიმდინარე ციკლი ვერ მოასწრებს, შემდეგი დაამუშავებს.'
            : result.reason === 'not_configured'
              ? 'მოთხოვნა რიგშია — GitHub-ის შემდეგი ავტომატური გაშვება დაამუშავებს. პირდაპირი გაშვების კავშირი ჯერ დასამატებელია.'
              : 'მოთხოვნა შენახულია, მაგრამ GitHub-ზე პირდაპირი გაშვება ვერ მოხერხდა. შემდეგი ავტომატური ციკლი კვლავ სცდის.',
      });
    }
    await db().query(
      `UPDATE sources SET enabled=COALESCE($2,enabled),auto_enabled=COALESCE($3,auto_enabled),
       interval_minutes=COALESCE($4,interval_minutes),auto_publish=COALESCE($5,auto_publish),
       requested_at=CASE WHEN $2=false OR $3=false THEN NULL ELSE requested_at END,
       next_run_at=CASE WHEN $3=true AND NOT auto_enabled THEN now() ELSE next_run_at END
       WHERE ($1='all' OR id=$1) AND NOT retired`,
      [
        data.id,
        data.enabled,
        data.autoEnabled,
        data.intervalMinutes,
        data.autoPublish,
      ],
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
