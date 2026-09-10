import { randomUUID } from 'node:crypto';
import { db, transaction } from '../lib/server/db';
import {
  configs,
  parseDetail,
  sourceLockIds,
  UnavailableVacancy,
} from './adapters';
import { stageVacancy } from './importer';
import { completeDescription } from './linked-description';
import { sourceFetch, SourceHttpError } from './http';
import { reconcileJob } from './automation';
import type { ActiveSourceId } from '../lib/types';
export async function refreshDescriptions(source: ActiveSourceId, limit = 100) {
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
    const items = (
      await c.query(
        `SELECT i.id,i.url FROM source_items i JOIN sources s ON s.id=i.source_id WHERE i.source_id=$1 AND s.enabled AND NOT s.retired AND i.refresh_requested_at IS NOT NULL AND (i.refresh_completed_at IS NULL OR i.refresh_requested_at>i.refresh_completed_at) AND i.next_check_at<=now() ORDER BY i.next_check_at,i.id LIMIT $2`,
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
      if (Date.now() - started > 18 * 60000) break;
      try {
        const html = await sourceFetch(source, item.url);
        primaryFailures = 0;
        const data = await completeDescription(
          parseDetail(source, html, item.url),
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
          `UPDATE source_items SET last_checked_at=now(),error=$2,failures=failures+1,next_check_at=now()+interval '30 minutes',refresh_completed_at=CASE WHEN $3 THEN now() ELSE refresh_completed_at END WHERE id=$1`,
          [item.id, (e as Error).message.slice(0, 500), gone],
        );
        if (gone) {
          removed++;
          const row = (
            await c.query('SELECT job_id FROM source_items WHERE id=$1', [
              item.id,
            ])
          ).rows[0];
          if (row?.job_id)
            await transaction((client) => reconcileJob(client, row.job_id));
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
