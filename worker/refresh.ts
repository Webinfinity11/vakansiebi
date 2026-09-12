import { randomUUID } from 'node:crypto';
import { db, transaction } from '../lib/server/db';
import {
  configs,
  detailRequestUrl,
  parseDetail,
  sourceLockIds,
  UnavailableVacancy,
} from './adapters';
import { stageVacancy, audit } from './importer';
import { completeDescription } from './linked-description';
import { sourceFetch, SourceHttpError } from './http';
import { reconcileJob } from './automation';
import type { ActiveSourceId } from '../lib/types';
export async function refreshDescriptions(
  source: ActiveSourceId,
  limit = 100,
  timeBudgetMs = 18 * 60_000,
) {
  if (!(source in configs)) throw Error('Unsupported source');
  const c = await db().connect();
  let locked = false;
  const started = Date.now();
  const runId = randomUUID();
  let runStarted = false;
  let primaryFailures = 0;
  let refreshed = 0,
    held = 0,
    failed = 0,
    removed = 0;
  try {
    locked = (
      await c.query('SELECT pg_try_advisory_lock($1) locked', [
        sourceLockIds[source],
      ])
    ).rows[0].locked;
    if (!locked)
      return {
        source,
        skipped: true,
        refreshed,
        held,
        failed,
        removed,
        remaining: 0,
      };
    const removedItems = (
      await c.query(
        `SELECT i.id FROM source_items i JOIN jobs j ON j.id=i.job_id
      WHERE i.source_id=$1 AND i.refresh_requested_at IS NOT NULL AND j.status='published'
      AND i.error IN ('Source vacancy unavailable','Source returned HTTP 404','Source returned HTTP 410')
      AND j.updated_at<=i.refresh_requested_at`,
        [source],
      )
    ).rows;
    for (const item of removedItems) await reconcileRemovedRefresh(item.id);
    const items = (
      await c.query(
        `SELECT i.id,i.url,i.raw,i.failures,i.listing_hints FROM source_items i JOIN sources s ON s.id=i.source_id WHERE i.source_id=$1 AND s.enabled AND NOT s.retired AND i.refresh_requested_at IS NOT NULL AND (i.refresh_completed_at IS NULL OR i.refresh_requested_at>i.refresh_completed_at) AND i.next_check_at<=now()
        ORDER BY CASE WHEN length(COALESCE(i.raw->>'description',''))<700 AND jsonb_array_length(COALESCE(i.raw->'applicationLinks','[]'::jsonb))>0 THEN 0 ELSE 1 END,i.next_check_at,i.id LIMIT $2`,
        [source, Math.max(1, Math.min(1000, limit))],
      )
    ).rows;
    if (items.length) {
      await c.query('INSERT INTO source_runs(id,source_id) VALUES($1,$2)', [
        runId,
        source,
      ]);
      runStarted = true;
    }
    for (const item of items) {
      if (Date.now() - started >= timeBudgetMs) break;
      try {
        const html = await sourceFetch(
          source,
          detailRequestUrl(source, item.url),
        );
        primaryFailures = 0;
        // An explicit refresh always re-reads the employer's page.
        const data = await completeDescription(
          parseDetail(source, html, item.url, item.listing_hints),
          item.raw,
          item.failures,
        );
        const result = await stageVacancy(item.id, data);
        if (result === 'quality_held') held++;
        else refreshed++;
      } catch (e) {
        if (
          (e as Error).message.startsWith('Source request failed:') ||
          e instanceof SourceHttpError
        )
          primaryFailures++;
        const gone =
          e instanceof UnavailableVacancy ||
          (e instanceof SourceHttpError && [404, 410].includes(e.status));
        await c.query(
          `UPDATE source_items SET last_checked_at=now(),error=$2,failures=failures+1,
          next_check_at=now()+(LEAST(1440,30*power(2,LEAST(failures,5)))*interval '1 minute'),
          refresh_completed_at=CASE WHEN $3 THEN now() ELSE refresh_completed_at END WHERE id=$1`,
          [item.id, (e as Error).message.slice(0, 500), gone],
        );
        if (gone) {
          removed++;
          const row = (
            await c.query('SELECT job_id FROM source_items WHERE id=$1', [
              item.id,
            ])
          ).rows[0];
          if (row?.job_id) await reconcileRemovedRefresh(item.id);
        } else failed++;
        console.log(
          JSON.stringify({
            source,
            item: item.id,
            error: (e as Error).message,
          }),
        );
      }
      if (primaryFailures >= 3) break;
      if ((refreshed + held + failed + removed) % 20 === 0)
        console.log(
          JSON.stringify({ source, refreshed, held, failed, removed }),
        );
    }
    const remaining = Number(
      (
        await c.query(
          'SELECT count(*) FROM source_items WHERE source_id=$1 AND refresh_requested_at IS NOT NULL AND (refresh_completed_at IS NULL OR refresh_requested_at>refresh_completed_at)',
          [source],
        )
      ).rows[0].count,
    );
    if (runStarted)
      await c.query(
        'UPDATE source_runs SET status=$2,finished_at=now(),changed=$3,failed=$4,error=$5 WHERE id=$1',
        [
          runId,
          failed || held ? 'partial' : 'success',
          refreshed,
          failed,
          failed || held
            ? `Description refresh: ${held} held, ${failed} failed, ${remaining} remaining`
            : null,
        ],
      );
    return { source, refreshed, held, failed, removed, remaining };
  } finally {
    if (locked)
      await c.query('SELECT pg_advisory_unlock($1)', [sourceLockIds[source]]);
    c.release();
  }
}

export async function reconcileRemovedRefresh(itemId: string) {
  return transaction(async (c) => {
    const item = (
      await c.query('SELECT * FROM source_items WHERE id=$1 FOR UPDATE', [
        itemId,
      ])
    ).rows[0];
    if (
      !item?.job_id ||
      !item.refresh_requested_at ||
      ![
        'Source vacancy unavailable',
        'Source returned HTTP 404',
        'Source returned HTTP 410',
      ].includes(item.error)
    )
      return 'skipped';
    const changed = await c.query(
      `UPDATE jobs SET automation_managed=true,automation_paused=false WHERE id=$1 AND status='published'
      AND published->>'url'=$2 AND updated_at<=$3 AND (automation_paused OR NOT automation_managed) RETURNING id`,
      [item.job_id, item.url, item.refresh_requested_at],
    );
    if (changed.rowCount)
      await audit(
        c,
        item.job_id,
        'automation.resumed',
        'requested:full-description-refresh',
        { reason: 'source_removed' },
        { automation_managed: true, automation_paused: false },
      );
    return reconcileJob(c, item.job_id);
  });
}
