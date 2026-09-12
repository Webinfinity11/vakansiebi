import { db, transaction } from '../lib/server/db';

/* Removes vacancies that have ended, once it is certain they will not come back.

   Measured before choosing the windows (audit log, all time): of 93 vacancies archived because
   their deadline passed, none was published again; of 53 archived because the source answered
   404/410, one came back after 21 hours. A deadline is a fixed date, so a day is enough; a
   removal can be a page being edited, and the worker rechecks those for seven days, so it waits
   the seven days.

   Only automation-managed, unpaused records are touched. An editor's work is never deleted by
   a schedule.

   The source item is kept with its job link cleared. That row is what tells the importer it has
   already seen this posting: re-read with a past deadline it records nothing (importer.ts), and
   re-read with an extended deadline it creates the vacancy again, which is the right outcome.

   The foreign keys to jobs have no ON DELETE rule, so the order below is not optional: clear
   every reference, then delete. One transaction per run, so a failure deletes nothing. */
const windows = { expired: '1 day', removed: '7 days' } as const;

export type PurgeResult = {
  expired: number;
  removed: number;
  applied: boolean;
};

const candidates = `SELECT id, automation_reason FROM jobs
  WHERE status='archived' AND automation_managed AND NOT automation_paused AND (
    (automation_reason='expired' AND updated_at < now() - interval '${windows.expired}') OR
    (automation_reason='removed' AND updated_at < now() - interval '${windows.removed}'))`;

export async function purgeEnded({
  apply = false,
}: { apply?: boolean } = {}): Promise<PurgeResult> {
  if (!apply) {
    const rows = (await db().query(candidates)).rows;
    return {
      expired: rows.filter((r) => r.automation_reason === 'expired').length,
      removed: rows.filter((r) => r.automation_reason === 'removed').length,
      applied: false,
    };
  }
  return transaction(async (c) => {
    // Several scraper jobs run at once; only one of them purges, the rest skip.
    const locked = (
      await c.query('SELECT pg_try_advisory_xact_lock(917410) ok')
    ).rows[0].ok;
    if (!locked) return { expired: 0, removed: 0, applied: false };
    const rows = (await c.query(candidates + ' FOR UPDATE')).rows;
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await c.query(
        'UPDATE jobs SET merged_into=NULL WHERE merged_into = ANY($1)',
        [ids],
      );
      await c.query(
        'UPDATE source_items SET job_id=NULL WHERE job_id = ANY($1)',
        [ids],
      );
      await c.query('DELETE FROM audit_log WHERE job_id = ANY($1)', [ids]);
      await c.query('DELETE FROM jobs WHERE id = ANY($1)', [ids]);
    }
    return {
      expired: rows.filter((r) => r.automation_reason === 'expired').length,
      removed: rows.filter((r) => r.automation_reason === 'removed').length,
      applied: true,
    };
  });
}
