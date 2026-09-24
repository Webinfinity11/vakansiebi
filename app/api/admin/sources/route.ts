import { z } from 'zod';
import { nextRunAt } from '@/worker/next-run';
import { db } from '@/lib/server/db';
import { githubScraperStatus } from '@/lib/server/scraper-github';
import { wakeScraper } from '@/lib/server/scraper-control';
import { sourceNames } from '@/lib/types';
import { scraperMetrics } from '@/lib/server/scraper-metrics';
import { scraperLimitFields } from '@/lib/scraper-limits';
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
        (SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.raw IS NULL AND i.error IS NULL AND i.next_check_at<=now()) due,
        (SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.error NOT IN ('Source vacancy unavailable','Source returned HTTP 404','Source returned HTTP 410')) errored,
        (SELECT count(*)::int FROM source_items i WHERE i.source_id=s.id AND i.error IN ('Source vacancy unavailable','Source returned HTTP 404','Source returned HTTP 410')) removed_count,
        (SELECT COALESCE(jsonb_agg(e),'[]'::jsonb) FROM (SELECT left(i.error,120) message,count(*)::int count FROM source_items i WHERE i.source_id=s.id AND i.error NOT IN ('Source vacancy unavailable','Source returned HTTP 404','Source returned HTTP 410') GROUP BY 1 ORDER BY 2 DESC LIMIT 3) e) top_errors,
        (SELECT count(*)::int FROM source_runs r WHERE r.source_id=s.id AND r.status='deferred' AND r.started_at>now()-interval '3 days') deferred_runs,
        (SELECT count(DISTINCT j.id)::int FROM source_items i JOIN jobs j ON j.id=i.job_id WHERE i.source_id=s.id AND j.status='published' AND (COALESCE(j.search_deadline,'')='' OR j.search_deadline>=to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD'))) published_count,
        (SELECT count(*)::int FROM source_discovery_pages p WHERE p.source_id=s.id AND p.observed_at>now()-interval '24 hours') observed_pages
        FROM sources s WHERE NOT s.retired AND s.id<>'jobx' ORDER BY s.id`,
      )
    ).rows;
    const runs = (
      await db().query(
        'SELECT r.* FROM source_runs r JOIN sources s ON s.id=r.source_id WHERE NOT s.retired ORDER BY r.started_at DESC LIMIT 20',
      )
    ).rows;
    const summary = (
      await db().query(`SELECT
      (SELECT jsonb_build_object(
        'pending',count(*) FILTER(WHERE status='pending'),
        'published',count(*) FILTER(WHERE status='published'),
        'review',count(*) FILTER(WHERE needs_review AND status<>'merged'),
        'archived',count(*) FILTER(WHERE status='archived'),
        'manual',count(*) FILTER(WHERE NOT automation_managed AND status NOT IN ('merged','rejected')),
        'paused',count(*) FILTER(WHERE automation_paused AND status NOT IN ('merged','rejected')),
        'blocked',count(*) FILTER(WHERE automation_reason IS NOT NULL AND status NOT IN ('merged','rejected','published')),
        'submissions',count(*) FILTER(WHERE status='pending' AND NOT sub.is_test),
        'submissions-published',count(*) FILTER(WHERE status='published' AND NOT sub.is_test),
        'submissions-closed',count(*) FILTER(WHERE status IN ('archived','rejected') AND NOT sub.is_test),
        'submissions-all',count(*) FILTER(WHERE status<>'merged' AND NOT sub.is_test),
        'submissions-test',count(*) FILTER(WHERE status<>'merged' AND sub.is_test),
        'reports',(SELECT count(*) FROM job_reports WHERE resolved_at IS NULL)
      ) FROM jobs LEFT JOIN job_submissions sub ON sub.job_id=jobs.id) counts,
      count(*)::int completed_runs,
      COALESCE(sum(r.imported),0)::int imported,
      COALESCE(sum(r.changed),0)::int changed,
      COALESCE(sum(r.failed),0)::int failed
      FROM source_runs r JOIN sources s ON s.id=r.source_id
      WHERE NOT s.retired AND r.finished_at>now()-interval '24 hours'`)
    ).rows[0];
    return Response.json({
      sources,
      runs,
      summary,
      metrics: await scraperMetrics(),
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
        // Every active source, so a new board is controllable the moment it is added.
        id: z.enum([
          ...(Object.keys(sourceNames) as [string, ...string[]]),
          'all',
        ]),
        action: z.enum(['run', 'configure', 'retry']),
        enabled: z.boolean().optional(),
        autoEnabled: z.boolean().optional(),
        intervalMinutes: z
          .union([
            z.literal(180),
            z.literal(360),
            z.literal(720),
            z.literal(1440),
          ])
          .optional(),
        detailIntervalHours: z.number().int().min(1).max(168).optional(),
        autoPublish: z.boolean().optional(),
        processingMode: z.enum(['economical', 'full']).optional(),
        ...scraperLimitFields,
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
      if (['hrgov', 'worknet'].includes(data.id))
        return Response.json({
          ok: true,
          message: 'მოთხოვნა შენახულია. Mac-ის შემდეგი შემოწმება დაამუშავებს.',
        });
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
       detail_interval_hours=COALESCE($6,detail_interval_hours),
       processing_mode=COALESCE($8,processing_mode),
       batch_limit=COALESCE($9,batch_limit),budget_minutes=COALESCE($10,budget_minutes),
       discovery_page_limit=COALESCE($11,discovery_page_limit),repair_limit=COALESCE($12,repair_limit),
       requested_at=CASE WHEN $2=false OR $3=false THEN NULL ELSE requested_at END,
       next_run_at=CASE WHEN $7::timestamptz IS NOT NULL THEN
         CASE WHEN consecutive_failures>0 THEN GREATEST(next_run_at,$7::timestamptz) ELSE $7::timestamptz END
         WHEN $3=true AND NOT auto_enabled THEN now() ELSE next_run_at END
       WHERE ($1='all' OR id=$1) AND NOT retired AND id<>'jobx'`,
      [
        data.id,
        data.enabled,
        data.autoEnabled,
        data.intervalMinutes,
        data.autoPublish,
        data.detailIntervalHours,
        data.intervalMinutes
          ? nextRunAt(data.intervalMinutes, Date.now(), 180)
          : null,
        data.processingMode,
        data.batchLimit,
        data.budgetMinutes,
        data.discoveryPageLimit,
        data.repairLimit,
      ],
    );
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
