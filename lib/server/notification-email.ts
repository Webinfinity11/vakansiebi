import type { PoolClient } from 'pg';
import type { InvoiceEmail } from '../invoice-email';
import { db } from './db';

export type NotificationKind = 'applications' | 'deadline' | 'candidate_ack' | 'job_rejected' | 'admin_review';
export function notificationEmailEnabled() {
  return !!process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL_ENABLED !== 'false';
}
export async function queueNotification(client: PoolClient, input: {
  kind: NotificationKind; dedupeKey: string; payload: InvoiceEmail;
}) {
  return !!(await client.query(
    'INSERT INTO notification_emails(kind,dedupe_key,payload) VALUES($1,$2,$3) ON CONFLICT(dedupe_key) DO NOTHING',
    [input.kind, input.dedupeKey, input.payload],
  )).rowCount;
}

export async function deliverNotifications(limit = 10) {
  if (!notificationEmailEnabled()) return { sent: 0, failed: 0, disabled: true };
  let sent = 0, failed = 0;
  const started = Date.now();
  for (let i = 0; i < Math.min(Math.max(limit, 0), 10); i++) {
    if (Date.now() - started > 40000) break;
    const row = (await db().query<{ id: string; payload: InvoiceEmail; attempts: number; expired: boolean }>(`
      WITH candidate AS (
        SELECT id, attempts>0 AND created_at<now()-interval '23 hours' AS expired
        FROM notification_emails
        WHERE status IN ('pending','sending') AND next_attempt_at<=now()
          AND (locked_until IS NULL OR locked_until<now())
        ORDER BY next_attempt_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED
      ) UPDATE notification_emails e SET status='sending',attempts=e.attempts+1,
          locked_until=now()+interval '2 minutes'
        FROM candidate c WHERE e.id=c.id RETURNING e.id,e.payload,e.attempts,c.expired
    `)).rows[0];
    if (!row) break;
    // Conservatively stop retries outside the provider's idempotency window.
    if (row.expired || row.attempts > 6) {
      await db().query("UPDATE notification_emails SET status='failed',locked_until=NULL,last_error=$2 WHERE id=$1", [row.id, row.attempts > 6 ? 'retry_limit_reached' : 'idempotency_window_expired']);
      failed++;
      continue;
    }
    let providerId: string | undefined, error = 'network_error', permanent = false;
    try {
      const payload = process.env.NODE_ENV === 'production' ? row.payload : {
        ...row.payload, to: ['delivered@resend.dev'], bcc: undefined,
      };
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json', 'Idempotency-Key': `jobx-notification/${row.id}`,
        }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && typeof result.id === 'string') providerId = result.id;
      else {
        error = `provider_${response.status}`;
        permanent = [400, 403, 422].includes(response.status) ||
          (response.status === 409 && result.name === 'invalid_idempotent_request');
      }
    } catch { /* Never log recipient data or provider bodies. */ }
    if (providerId) {
      await db().query("UPDATE notification_emails SET status='sent',provider_id=$2,sent_at=now(),locked_until=NULL,last_error=NULL WHERE id=$1", [row.id, providerId]);
      sent++;
    } else {
      await db().query(`UPDATE notification_emails SET status=$2,last_error=$3,locked_until=NULL,
        next_attempt_at=now()+make_interval(secs=>$4) WHERE id=$1`,
      [row.id, permanent || row.attempts >= 6 ? 'failed' : 'pending', error, Math.min(3600, 60 * 2 ** row.attempts)]);
      failed++;
    }
  }
  return { sent, failed, disabled: false };
}
