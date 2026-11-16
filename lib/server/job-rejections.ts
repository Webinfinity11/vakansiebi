import type { PoolClient } from 'pg';
import { safeEmail } from '../application-contact';
import { rejectionSchema } from '../job-rejection';
import { jobRejectionEmail } from '../job-rejection-email';
import { queueNotification } from './notification-email';

export async function saveRejection(client: PoolClient, jobId: string, input: unknown) {
  const { reason, note } = rejectionSchema.parse(input);
  await client.query(`INSERT INTO job_rejections(job_id,reason,note) VALUES($1,$2,$3)
    ON CONFLICT(job_id) DO UPDATE SET reason=EXCLUDED.reason,note=EXCLUDED.note,created_at=now()`, [jobId, reason, note]);
}

export async function queueRejectionEmail(client: PoolClient, job: { id: string }) {
  // Read the post-mutation version and the reason within the same transaction.
  const row = (await client.query(`SELECT j.version,j.draft->>'title' AS title,
    s.notification_email,s.is_test,r.reason,r.note,
    EXISTS(SELECT 1 FROM company_job_ownership o WHERE o.job_id=j.id) AS owned
    FROM jobs j JOIN job_submissions s ON s.job_id=j.id
    JOIN job_rejections r ON r.job_id=j.id WHERE j.id=$1 AND j.status='rejected'`, [job.id])).rows[0];
  if (!row || row.is_test || !safeEmail(row.notification_email || '')) return false;
  return queueNotification(client, {
    kind: 'job_rejected', dedupeKey: `rejected:${job.id}:${row.version}`,
    payload: jobRejectionEmail({ id: job.id, title: row.title, owned: row.owned }, row,
      row.notification_email, process.env.APP_URL || 'https://jobx.ge'),
  });
}

// Called by the admin mutation callback, so a missing/invalid reason rolls back
// the status change as well. Old imported-job reject callers remain supported.
export async function recordJobRejection(client: PoolClient, jobId: string, input: { reason?: unknown; note?: unknown }) {
  const submitted = (await client.query('SELECT 1 FROM job_submissions WHERE job_id=$1', [jobId])).rowCount;
  if (!submitted && input.reason === undefined && input.note === undefined) return false;
  await saveRejection(client, jobId, input);
  return queueRejectionEmail(client, { id: jobId });
}
