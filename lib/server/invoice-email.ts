import type { PoolClient } from 'pg';
import { db } from './db';
import { invoiceEmail, type InvoiceEmail } from '../invoice-email';
import type { JobInvoice } from '../billing';

export function invoiceEmailEnabled() {
  return (
    process.env.INVOICE_EMAIL_ENABLED === 'true' && !!process.env.RESEND_API_KEY
  );
}

export async function queueInvoiceEmail(
  c: PoolClient,
  invoice: JobInvoice,
  recipient: string,
) {
  const payload = invoiceEmail(
    invoice,
    recipient,
    process.env.APP_URL || 'https://jobx.ge',
  );
  await c.query(
    'INSERT INTO invoice_email_delivery(invoice_id,payload) VALUES($1,$2) ON CONFLICT(invoice_id) DO NOTHING',
    [invoice.id, payload],
  );
}

// The immutable payload and provider key make overlapping requests and short retries safe.
export async function deliverInvoiceEmails(jobId?: string, limit = 1) {
  if (!invoiceEmailEnabled()) return { sent: 0, failed: 0, disabled: true };
  let sent = 0;
  let failed = 0;
  for (let index = 0; index < Math.min(limit, 5); index++) {
    const row = (
      await db().query<{
        invoice_id: string;
        payload: InvoiceEmail;
        attempts: number;
        expired: boolean;
        payable: boolean;
        previous_attempt: Date | null;
      }>(
        `WITH candidate AS (
        SELECT e.invoice_id,e.first_attempt_at AS previous_attempt FROM invoice_email_delivery e
        JOIN job_invoices i ON i.id=e.invoice_id
        WHERE e.status IN ('pending','sending') AND e.next_attempt_at<=now()
          AND (e.locked_until IS NULL OR e.locked_until<now())
          AND ($1::uuid IS NULL OR i.job_id=$1::uuid)
        ORDER BY e.next_attempt_at,e.created_at
        LIMIT 1 FOR UPDATE OF e SKIP LOCKED
      )
      UPDATE invoice_email_delivery e SET status='sending',locked_until=now()+interval '2 minutes',
        attempts=e.attempts+1,first_attempt_at=COALESCE(e.first_attempt_at,now())
      FROM candidate c, job_invoices i WHERE e.invoice_id=c.invoice_id AND i.id=e.invoice_id
      RETURNING e.invoice_id,e.payload,e.attempts,c.previous_attempt,
        e.first_attempt_at<now()-interval '23 hours' AS expired,
        i.status IN ('pending','paid') AS payable`,
        [jobId || null],
      )
    ).rows[0];
    if (!row) break;
    if (row.expired || !row.payable) {
      await db().query(
        'UPDATE invoice_email_delivery SET status=$2,locked_until=NULL,last_error=$3 WHERE invoice_id=$1',
        [
          row.invoice_id,
          row.payable ? 'failed' : 'cancelled',
          row.expired ? 'idempotency_window_expired' : 'invoice_cancelled',
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
          'Idempotency-Key': `jobx-invoice/${row.invoice_id}`,
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
      // Don't log provider bodies, recipient addresses, tokens or invoice contents.
    }
    if (providerId) {
      // A failed database write leaves a lease; the same provider key recovers the result.
      await db().query(
        "UPDATE invoice_email_delivery SET status='sent',provider_id=$2,sent_at=now(),locked_until=NULL,last_error=NULL WHERE invoice_id=$1",
        [row.invoice_id, providerId],
      );
      sent++;
    } else {
      await db().query(
        `UPDATE invoice_email_delivery SET status=$2,last_error=$3,locked_until=NULL,
          next_attempt_at=now()+make_interval(secs=>$4),
          first_attempt_at=CASE WHEN $5 THEN NULL ELSE first_attempt_at END
        WHERE invoice_id=$1`,
        [
          row.invoice_id,
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
