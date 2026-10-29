import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { db } from './db';
import { filtersSchema, type SearchFilters } from '../personal-space';
import { readSearch, searchParams } from '../search-state';
import { searchHeading } from '../seo-landing';
import { searchPlan } from './search-plan';
import { safeEmail } from '../application-contact';
import {
  alertToken,
  readAlertToken,
  alertLink,
  confirmationEmail,
  digestEmail,
  type AlertJob,
  type AlertAction,
  type AlertEmail,
} from '../job-alerts';

type Settings = Record<string, string | undefined>;
type Subscription = {
  id: string;
  nonce: string;
  email: string;
  filters: SearchFilters;
  label: string;
  status: string;
  cursor_at: Date;
};
export function jobAlertsEnabled(settings: Settings = process.env) {
  return (
    settings.JOB_ALERTS_ENABLED === 'true' &&
    !!settings.RESEND_API_KEY &&
    (settings.SESSION_SECRET?.length || 0) >= 32
  );
}
const appUrl = (settings: Settings) => settings.APP_URL || 'https://jobx.ge';

/** Request ownership confirmation; a repeated request cannot alter an active subscription. */
export async function requestJobAlert(
  emailRaw: string,
  input: unknown,
  pool: Pool = db(),
  settings: Settings = process.env,
) {
  const email = safeEmail(emailRaw)?.toLowerCase();
  if (!email) throw new Error('Invalid alert email');
  const filters = readSearch(searchParams(filtersSchema.parse(input)));
  const key = createHash('sha256')
    .update(searchParams(filters).toString())
    .digest('hex');
  const label = searchHeading(filters) || 'ყველა ვაკანსია';
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,726))', [
      email,
    ]);
    const allowed = (
      await c.query(
        `SELECT count(*) FILTER (WHERE requested_at>now()-interval '1 hour')::int AS recent,
      count(*) FILTER (WHERE status IN ('pending','active'))::int AS total FROM job_alert_subscriptions WHERE email=$1`,
        [email],
      )
    ).rows[0];
    const existing = (
      await c.query(
        'SELECT status FROM job_alert_subscriptions WHERE email=$1 AND filter_key=$2',
        [email, key],
      )
    ).rows[0];
    if (
      allowed.recent > 0 ||
      existing?.status === 'active' ||
      (!existing && allowed.total >= 5)
    ) {
      await c.query('COMMIT');
      return null;
    }
    const row = (
      await c.query<Subscription>(
        `INSERT INTO job_alert_subscriptions(email,filter_key,filters,label) VALUES($1,$2,$3,$4)
      ON CONFLICT(email,filter_key) DO UPDATE SET nonce=gen_random_uuid(),status='pending',requested_at=now(),filters=excluded.filters,label=excluded.label
      RETURNING *`,
        [email, key, filters, label],
      )
    ).rows[0];
    await c.query(
      "UPDATE job_alert_deliveries SET status='cancelled' WHERE subscription_id=$1 AND status IN ('pending','sending')",
      [row.id],
    );
    const token = alertToken(
      row.id,
      row.nonce,
      'confirm',
      settings.SESSION_SECRET || '',
      Date.now() + 86400000,
    );
    const payload = confirmationEmail(
      email,
      label,
      alertLink(appUrl(settings), token, 'confirm'),
      appUrl(settings),
    );
    const delivery = (
      await c.query<{ id: string }>(
        "INSERT INTO job_alert_deliveries(subscription_id,kind,payload) VALUES($1,'confirmation',$2) RETURNING id",
        [row.id, payload],
      )
    ).rows[0];
    await c.query('COMMIT');
    return delivery.id;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/** Confirmation requires a user's POST; email scanners opening the link do not subscribe. */
export async function manageJobAlert(
  token: string,
  action: AlertAction,
  pool: Pool = db(),
  settings: Settings = process.env,
) {
  const parsed = readAlertToken(token, action, settings.SESSION_SECRET || '');
  if (!parsed) return false;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const row = (
      await c.query<Subscription>(
        'SELECT * FROM job_alert_subscriptions WHERE id=$1 AND nonce=$2 FOR UPDATE',
        [parsed.id, parsed.nonce],
      )
    ).rows[0];
    if (!row || (action === 'confirm' && row.status === 'unsubscribed')) {
      await c.query('COMMIT');
      return false;
    }
    if (action === 'confirm' && row.status === 'pending')
      await c.query(
        "UPDATE job_alert_subscriptions SET status='active',confirmed_at=now(),cursor_at=now(),next_digest_at=now()+interval '1 day' WHERE id=$1",
        [row.id],
      );
    if (action === 'unsubscribe') {
      await c.query(
        "UPDATE job_alert_subscriptions SET status='unsubscribed' WHERE id=$1",
        [row.id],
      );
      await c.query(
        "UPDATE job_alert_deliveries SET status='cancelled',lease_token=NULL,locked_until=NULL WHERE subscription_id=$1 AND status IN ('pending','sending')",
        [row.id],
      );
    }
    await c.query('COMMIT');
    return true;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

export async function prepareJobDigests({
  pool = db(),
  settings = process.env,
  limit = 20,
  subscriptionId,
}: {
  pool?: Pool;
  settings?: Settings;
  limit?: number;
  subscriptionId?: string;
} = {}) {
  if (!jobAlertsEnabled(settings)) return { prepared: 0, disabled: true };
  let prepared = 0;
  const started = Date.now();
  for (let i = 0; i < Math.min(limit, 40); i++) {
    if (Date.now() - started >= 15000) break;
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SET LOCAL statement_timeout='6s'");
      const row = (
        await c.query<Subscription>(
          "SELECT * FROM job_alert_subscriptions WHERE status='active' AND next_digest_at<=now() AND ($1::uuid IS NULL OR id=$1) ORDER BY next_digest_at LIMIT 1 FOR UPDATE SKIP LOCKED",
          [subscriptionId || null],
        )
      ).rows[0];
      if (!row) {
        await c.query('COMMIT');
        break;
      }
      const plan = searchPlan(searchParams(row.filters), false, {
        grouped: true,
      });
      const args = [...plan.args, row.cursor_at, row.id];
      const jobs = (
        await c.query<AlertJob>(
          `${plan.cte} SELECT j.id,j.p_title AS title,j.p_company AS company,COALESCE(record.search_salary,'') AS salary,j.p_city AS city,j.group_key
        FROM searchable j JOIN jobs record ON record.id=j.id WHERE ${plan.where}
        AND COALESCE(j.published_at,j.created_at)>$${args.length - 1} AND COALESCE(j.published_at,j.created_at)<=now()
        AND NOT EXISTS(SELECT 1 FROM job_alert_seen s WHERE s.subscription_id=$${args.length} AND s.group_key=j.group_key)
        ORDER BY COALESCE(j.published_at,j.created_at) DESC,j.id LIMIT 20`,
          args,
        )
      ).rows;
      if (jobs.length) {
        const cancel = alertLink(
          appUrl(settings),
          alertToken(
            row.id,
            row.nonce,
            'unsubscribe',
            settings.SESSION_SECRET || '',
          ),
          'unsubscribe',
        );
        const payload = digestEmail(
          row.email,
          row.label,
          jobs,
          `${appUrl(settings)}/?${searchParams(row.filters)}`,
          cancel,
          appUrl(settings),
        );
        await c.query(
          "INSERT INTO job_alert_deliveries(subscription_id,kind,payload) VALUES($1,'digest',$2)",
          [row.id, payload],
        );
        await c.query(
          'INSERT INTO job_alert_seen(subscription_id,group_key) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING',
          [row.id, jobs.map((j) => j.group_key)],
        );
        prepared++;
      }
      await c.query(
        "UPDATE job_alert_subscriptions SET cursor_at=now(),next_digest_at=now()+interval '1 day' WHERE id=$1",
        [row.id],
      );
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }
  return { prepared, disabled: false };
}

export async function deliverJobAlerts({
  pool = db(),
  settings = process.env,
  request = fetch,
  limit = 5,
  id,
}: {
  pool?: Pool;
  settings?: Settings;
  request?: typeof fetch;
  limit?: number;
  id?: string;
} = {}) {
  if (!jobAlertsEnabled(settings))
    return { sent: 0, failed: 0, disabled: true };
  let sent = 0,
    failed = 0;
  const started = Date.now();
  for (let i = 0; i < Math.min(limit, 40); i++) {
    if (Date.now() - started >= 20000) break;
    const lease = randomUUID();
    const row = (
      await pool.query<{
        id: string;
        payload: AlertEmail;
        attempts: number;
        expired: boolean;
      }>(
        `WITH candidate AS (
      SELECT d.id FROM job_alert_deliveries d JOIN job_alert_subscriptions s ON s.id=d.subscription_id
      WHERE d.status IN ('pending','sending') AND d.next_attempt_at<=now() AND (d.locked_until IS NULL OR d.locked_until<now())
      AND ((d.kind='confirmation' AND s.status='pending') OR (d.kind='digest' AND s.status='active'))
      AND ($1::uuid IS NULL OR d.id=$1) ORDER BY d.created_at LIMIT 1 FOR UPDATE OF d SKIP LOCKED)
      UPDATE job_alert_deliveries d SET status='sending',attempts=attempts+1,lease_token=$2,locked_until=now()+interval '2 minutes',
        first_attempt_at=COALESCE(first_attempt_at,now()) FROM candidate c WHERE d.id=c.id
      RETURNING d.id,d.payload,d.attempts,(d.created_at<now()-interval '23 hours') AS expired`,
        [id || null, lease],
      )
    ).rows[0];
    if (!row) break;
    if (row.expired) {
      await pool.query(
        "UPDATE job_alert_deliveries SET status='failed',last_error='delivery_window_expired',locked_until=NULL WHERE id=$1 AND lease_token=$2",
        [row.id, lease],
      );
      failed++;
      continue;
    }
    let providerId: string | undefined;
    let code = 'network_error';
    let permanent = false;
    try {
      const response = await request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `jobx-alert/${row.id}`,
        },
        body: JSON.stringify(row.payload),
        signal: AbortSignal.timeout(8000),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && typeof body.id === 'string') providerId = body.id;
      else {
        code = `provider_${response.status}`;
        permanent =
          [400, 403, 422].includes(response.status) ||
          (response.status === 409 &&
            body.name === 'invalid_idempotent_request');
      }
    } catch {
      /* Never log recipients, tokens or provider bodies. */
    }
    await pool.query(
      `UPDATE job_alert_deliveries SET status=$3,provider_id=$4,last_error=$5,locked_until=NULL,
      sent_at=CASE WHEN $3='sent' THEN now() ELSE NULL END,next_attempt_at=now()+make_interval(secs=>$6)
      WHERE id=$1 AND lease_token=$2`,
      [
        row.id,
        lease,
        providerId
          ? 'sent'
          : permanent || row.attempts >= 6
            ? 'failed'
            : 'pending',
        providerId || null,
        providerId ? null : code,
        Math.min(3600, 60 * 2 ** row.attempts),
      ],
    );
    if (providerId) sent++;
    else failed++;
  }
  return { sent, failed, disabled: false };
}
