import dotenv from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { db } from '../lib/server/db';
import {
  pendingNewItemsWhere,
  retireStaleNewItemsSql,
  retireUnusedReviewsSql,
} from '../worker/new-only';
import { nextRunAt } from '../worker/next-run';
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
const apply = process.argv.includes('--apply');
const client = await db().connect();
try {
  await client.query('BEGIN');
  await client.query(
    "SET LOCAL statement_timeout='20s'; SET LOCAL lock_timeout='3s'",
  );
  const sources = (
    await client.query(
      "SELECT id,lease_until>now() active,next_run_at FROM sources WHERE NOT retired AND id<>'jobx' ORDER BY id FOR UPDATE",
    )
  ).rows;
  if (sources.some((s) => s.active))
    throw Error('Wait for active collectors to release their source leases.');
  const rows = (
    await client.query(
      `SELECT * FROM source_items i WHERE source_id=ANY($1::text[]) AND (
   (job_id IS NULL AND raw IS NULL AND next_check_at<'infinity'::timestamptz AND NOT (${pendingNewItemsWhere('i')}))
   OR ((quality_warning IS NOT NULL OR refresh_requested_at IS NOT NULL) AND NOT (${pendingNewItemsWhere('i')}))) ORDER BY source_id,id`,
      [sources.map((s) => s.id)],
    )
  ).rows;
  const counts = (
    await client.query(
      'SELECT status,count(*)::int count FROM jobs GROUP BY status ORDER BY status',
    )
  ).rows;
  mkdirSync('reports', { recursive: true });
  const name = `reports/scraper-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  writeFileSync(
    name + '-backup.json',
    JSON.stringify({ sources, rows, counts }, null, 2),
    { mode: 0o600 },
  );
  if (!apply) {
    await client.query('ROLLBACK');
    console.log(JSON.stringify({ apply, eligible: rows.length }));
  } else {
    let retired = 0,
      reviews = 0;
    for (const source of sources) {
      retired +=
        (await client.query(retireStaleNewItemsSql, [source.id])).rowCount || 0;
      reviews +=
        (await client.query(retireUnusedReviewsSql, [source.id])).rowCount || 0;
      await client.query(
        `UPDATE sources SET quality_warning=NULL WHERE id=$1 AND quality_warning ~ '^[0-9]+ detail snapshots held for quality review$' AND NOT EXISTS(SELECT 1 FROM source_items i WHERE i.source_id=$1 AND i.quality_warning IS NOT NULL AND ${pendingNewItemsWhere('i')})`,
        [source.id],
      );
      if (
        !['hrgov', 'worknet', 'jobtl'].includes(source.id) &&
        new Date(source.next_run_at).getTime() > Date.now()
      )
        await client.query('UPDATE sources SET next_run_at=$2 WHERE id=$1', [
          source.id,
          nextRunAt(0, new Date(source.next_run_at).getTime(), 180),
        ]);
    }
    const after = (
      await client.query(
        'SELECT status,count(*)::int count FROM jobs GROUP BY status ORDER BY status',
      )
    ).rows;
    if (JSON.stringify(counts) !== JSON.stringify(after))
      throw Error('Vacancy statuses changed during queue cleanup.');
    await client.query('COMMIT');
    const result = {
      apply,
      retired,
      reviews,
      vacanciesUnchanged: true,
      checkedAt: new Date().toISOString(),
    };
    writeFileSync(name + '-result.json', JSON.stringify(result, null, 2), {
      mode: 0o600,
    });
    console.log(JSON.stringify(result));
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await db().end();
}
