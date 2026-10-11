import { db, transaction } from '../lib/server/db';

/* Removes vacancies that have ended, once it is certain they will not come back.

   Measured before choosing the windows (audit log, all time): of 93 vacancies archived because
   their deadline passed, none was published again; of 53 archived because the source answered
   404/410, one came back after 21 hours. A deadline is a fixed date, so a day is enough; a
   removal can be a page being edited, and the worker rechecks those for seven days, so it waits
   the seven days.

   An editor's own archive or rejection waits a month before it goes (the archive must not
   grow without end); JOBX submissions and invoiced records are never deleted.

   The source item is retained after clearing its job link. Its ID and raw snapshot
   prevent the new-only worker from importing it again, even if a listing repeats it.

   The foreign keys to jobs have no ON DELETE rule, so the order below is not optional: clear
   every reference, then delete. One transaction per run, so a failure deletes nothing. */
const windows = {
  expired: '1 day',
  removed: '7 days',
  // Not verified for a week before it was archived; another week is enough.
  unverified: '14 days',
  // An editor's archive or rejection, kept a month in case it is wanted back.
  editor: '30 days',
} as const;

export type PurgeResult = {
  expired: number;
  removed: number;
  unverified: number;
  editor: number;
  /** Hand-managed vacancies past their deadline, moved to the archive. */
  archived: number;
  applied: boolean;
};

/* JOBX's own submissions and anything with an invoice are business records and
   are never deleted; their foreign keys would refuse it anyway. */
const keep = `NOT EXISTS (SELECT 1 FROM job_submissions s WHERE s.job_id=j.id)
    AND NOT EXISTS (SELECT 1 FROM job_invoices i WHERE i.job_id=j.id)`;
const candidates = `SELECT id, CASE
    WHEN automation_managed AND NOT automation_paused AND automation_reason IN ('expired','removed','unverified') THEN automation_reason
    ELSE 'editor' END AS kind FROM jobs j
  WHERE status IN ('archived','rejected') AND ${keep} AND (
    (automation_managed AND NOT automation_paused AND status='archived' AND (
      (automation_reason='expired' AND updated_at < now() - interval '${windows.expired}') OR
      (automation_reason='removed' AND updated_at < now() - interval '${windows.removed}') OR
      (automation_reason='unverified' AND updated_at < now() - interval '${windows.unverified}'))) OR
    updated_at < now() - interval '${windows.editor}')`;
/* A hand-managed vacancy is outside automation, so nothing archived it when its
   deadline passed: it sat "published" in the admin, hidden from the site. */
const expiredManual = `FROM jobs j WHERE status IN ('published','pending') AND automation_paused
    AND COALESCE(draft->>'deadline','')<>''
    AND draft->>'deadline' < to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD')
    AND ${keep}`;
const count = (rows: { kind: string }[], kind: string) =>
  rows.filter((r) => r.kind === kind).length;

export async function purgeEnded({
  apply = false,
}: { apply?: boolean } = {}): Promise<PurgeResult> {
  if (!apply) {
    const rows = (await db().query(candidates)).rows;
    const archived = (
      await db().query(`SELECT count(*)::int n ${expiredManual}`)
    ).rows[0].n;
    return {
      expired: count(rows, 'expired'),
      removed: count(rows, 'removed'),
      unverified: count(rows, 'unverified'),
      editor: count(rows, 'editor'),
      archived,
      applied: false,
    };
  }
  return transaction(async (c) => {
    // Several scraper jobs run at once; only one of them purges, the rest skip.
    const locked = (
      await c.query('SELECT pg_try_advisory_xact_lock(917410) ok')
    ).rows[0].ok;
    if (!locked)
      return {
        expired: 0,
        removed: 0,
        unverified: 0,
        editor: 0,
        archived: 0,
        applied: false,
      };
    const archived = (
      await c.query(
        `UPDATE jobs SET status='archived',automation_reason='expired',needs_review=false,
          published=NULL,version=version+1,updated_at=now()
         WHERE id IN (SELECT id ${expiredManual})`,
      )
    ).rowCount;
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
      expired: count(rows, 'expired'),
      removed: count(rows, 'removed'),
      unverified: count(rows, 'unverified'),
      editor: count(rows, 'editor'),
      archived: archived ?? 0,
      applied: true,
    };
  });
}
