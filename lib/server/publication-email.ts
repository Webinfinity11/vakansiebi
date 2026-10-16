import type { PoolClient } from 'pg';
import { db } from './db';
import type { InvoiceEmail } from '../invoice-email';
import { publicationEmail } from '../publication-email';
import { safeEmail } from '../application-contact';
import { invoiceEmailEnabled } from './invoice-email';
// Runs in the same transaction as first publication. Imported/test jobs and
// historical re-publications do not notify an employer.
export async function queuePublicationEmail(
  c: PoolClient,
  job: { id: string; title: string; company: string },
) {
  const submission = (
    await c.query(
      'SELECT notification_email,is_test FROM job_submissions WHERE job_id=$1',
      [job.id],
    )
  ).rows[0];
  if (
    !submission ||
    submission.is_test ||
    !safeEmail(submission.notification_email || '')
  )
    return false;
  const payload = publicationEmail(
    job,
    submission.notification_email,
    process.env.APP_URL || 'https://jobx.ge',
  );
  return !!(
    await c.query(
      'INSERT INTO publication_email_delivery(job_id,payload) VALUES($1,$2) ON CONFLICT(job_id) DO NOTHING',
      [job.id, payload],
    )
  ).rowCount;
}

// The immutable payload and provider key make overlapping requests and short retries safe.
export async function deliverPublicationEmails(jobId?: string, limit = 1) {
  if (!invoiceEmailEnabled()) return { sent: 0, failed: 0, disabled: true };
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < Math.min(limit, 5); index++) {
    const row = (
      await db().query<{
        job_id: string;
        payload: InvoiceEmail;
        attempts: number;
        expired: boolean;
        visible: boolean;
        previous_attempt: Date | null;
      }>(
        `WITH candidate AS (
        SELECT e.job_id,e.first_attempt_at AS previous_attempt FROM publication_email_delivery e
        JOIN jobs j ON j.id=e.job_id
        WHERE e.status IN ('pending','sending') AND e.next_attempt_at<=now()
          AND (e.locked_until IS NULL OR e.locked_until<now())
          AND ($1::uuid IS NULL OR j.id=$1::uuid)
        ORDER BY e.next_attempt_at,e.created_at
        LIMIT 1 FOR UPDATE OF e SKIP LOCKED
      )
      UPDATE publication_email_delivery e SET status='sending',locked_until=now()+interval '2 minutes',
        attempts=e.attempts+1,first_attempt_at=COALESCE(e.first_attempt_at,now())
      FROM candidate c, jobs j, job_submissions s WHERE e.job_id=c.job_id AND j.id=e.job_id AND s.job_id=j.id
      RETURNING e.job_id,e.payload,e.attempts,c.previous_attempt,
        e.first_attempt_at<now()-interval '23 hours' AS expired,
        (j.status='published' AND j.published IS NOT NULL AND NOT s.is_test
          AND (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline'>=(now() AT TIME ZONE 'Asia/Tbilisi')::date::text)) AS visible`,
        [jobId || null],
      )
    ).rows[0];
    if (!row) break;
    if (row.expired || !row.visible) {
      await db().query(
        'UPDATE publication_email_delivery SET status=$2,locked_until=NULL,last_error=$3 WHERE job_id=$1',
        [
          row.job_id,
          row.visible ? 'failed' : 'cancelled',
          row.expired ? 'idempotency_window_expired' : 'vacancy_unavailable',
        ],
      );
      failed++;
      continue;
    }
    let providerId: string | undefined;
    let error = 'network_error';
    let definitiveRejection = false;
    let permanent = false;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `jobx-publication/${row.job_id}`,
        },
        body: JSON.stringify(row.payload),
        signal: AbortSignal.timeout(8000),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && typeof result.id === 'string') providerId = result.id;
      else {
        error = `provider_${response.status}`;
        definitiveRejection =
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 409;
        permanent =
          [400, 403, 422].includes(response.status) ||
          (response.status === 409 &&
            result.name === 'invalid_idempotent_request');
      }
    } catch {
      // Don't log provider bodies, recipient addresses, tokens or vacancy contents.
    }
    if (providerId) {
      // A failed database write leaves a lease; the same provider key recovers the result.
      await db().query(
        "UPDATE publication_email_delivery SET status='sent',provider_id=$2,sent_at=now(),locked_until=NULL,last_error=NULL WHERE job_id=$1",
        [row.job_id, providerId],
      );
      sent++;
    } else {
      await db().query(
        `UPDATE publication_email_delivery SET status=$2,last_error=$3,locked_until=NULL,
          next_attempt_at=now()+make_interval(secs=>$4),
          first_attempt_at=CASE WHEN $5 THEN NULL ELSE first_attempt_at END
        WHERE job_id=$1`,
        [
          row.job_id,
          permanent || row.attempts >= 6 ? 'failed' : 'pending',
          error,
          Math.min(3600, 60 * 2 ** row.attempts),
          definitiveRejection && !row.previous_attempt,
        ],
      );
      failed++;
    }
  }
  return { sent, failed, disabled: false };
}
