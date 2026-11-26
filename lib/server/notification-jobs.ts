import type { PoolClient } from 'pg';
import { safeEmail } from '../application-contact';
import { applicationsEmail, placementRenewalEmail } from '../notification-emails';
import { db, transaction } from './db';
import { createInvoiceDetails } from './billing';
import { deliverNotifications, queueNotification } from './notification-email';

// Same source and ownership rules as company-candidates; never include staff uploads.
const entriesSql = `WITH owned AS (
  SELECT j.id,COALESCE(j.published->>'title',j.draft->>'title','ვაკანსია') title
  FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id WHERE o.company_key=$1
), entries AS (
  SELECT 'swipe:'||a.id entry,a.job_id,o.title,a.candidate_name name,a.candidate_email email,
    COALESCE(a.sent_at,a.created_at) applied_at
  FROM swipe_applications a JOIN owned o ON o.id=a.job_id WHERE a.status='sent'
  UNION ALL
  SELECT 'resume:'||c.job_id||':'||c.resume_id,c.job_id,o.title,r.cv->>'fullName',r.cv->>'email',c.first_at
  FROM resume_contacts c JOIN owned o ON o.id=c.job_id
  JOIN resumes r ON r.id=c.resume_id AND r.expires_at>now() WHERE c.kind='cv'
  UNION ALL
  SELECT 'upload:'||u.id,u.job_id,COALESCE(o.title,'კომპანიის რეზიუმეების ყუთი'),u.name,u.email,u.created_at
  FROM company_cv_uploads u LEFT JOIN owned o ON o.id=u.job_id
  WHERE u.company_key=$1 AND u.source='cv_box'
) SELECT * FROM entries WHERE applied_at>$2 AND applied_at<=$3 ORDER BY applied_at,entry`;
type Entry = { entry: string; job_id: string | null; title: string; name: string; email: string; applied_at: Date };
type SettingsRow = {
  application_mode: 'instant' | 'digest' | 'off'; deadline_reminders: boolean;
  applications_seen_until: Date;
  last_digest_on: string | null;
};
export function notificationDay(now: Date) {
  // Tbilisi has no DST: UTC+04. ISO format also sorts as a calendar date.
  return new Date(now.getTime() + 4 * 3600000).toISOString().slice(0, 10);
}
export function digestDue(now: Date, lastDigestOn: string | null) {
  return new Date(now.getTime() + 4 * 3600000).getUTCHours() >= 9 && lastDigestOn !== notificationDay(now);
}

async function queueCompany(client: PoolClient, companyKey: string, now: Date, instantOnly: boolean) {
  // Existing profiles were seeded by 086. A later account starts at its creation,
  // so its first application is not discarded by lazy initialization.
  await client.query(`INSERT INTO company_notification_settings(company_key,applications_seen_until)
    SELECT p.company_key,COALESCE((SELECT min(a.created_at) FROM company_accounts a WHERE a.company_key=p.company_key),$2)
    FROM company_profiles p WHERE p.company_key=$1 ON CONFLICT DO NOTHING`, [companyKey, now]);
  const s = (await client.query<SettingsRow>(`SELECT application_mode,deadline_reminders,
    applications_seen_until,last_digest_on::text FROM company_notification_settings
    WHERE company_key=$1 FOR UPDATE`, [companyKey])).rows[0];
  if (!s) return 0;
  const owner = (await client.query(`SELECT a.email,p.name FROM company_accounts a
    JOIN company_profiles p USING(company_key)
    WHERE a.company_key=$1 AND a.role='owner' AND a.enabled AND a.email_verified`, [companyKey])).rows[0];
  if (!owner || !safeEmail(owner.email)) return 0;
  const appUrl = process.env.APP_URL || 'https://jobx.ge';
  let queued = 0;
  const enqueue: typeof queueNotification = async (c, value) => {
    const added = await queueNotification(c, value);
    if (added) queued++;
    return added;
  };
  const due = s.application_mode === 'instant' || (!instantOnly && digestDue(now, s.last_digest_on));
  if (s.application_mode === 'off' || due) {
    if (s.application_mode !== 'off') {
      const entries = (await client.query<Entry>(entriesSql, [companyKey, s.applications_seen_until, now])).rows;
      if (entries.length) {
        const counts = new Map<string, { title: string; count: number }>();
        for (const entry of entries) {
          const key = entry.job_id ?? 'cv_box';
          const summary = counts.get(key) ?? { title: entry.title, count: 0 };
          summary.count++; counts.set(key, summary);
        }
        await enqueue(client, {
          kind: 'applications',
          dedupeKey: s.application_mode === 'digest' ? `applications:${companyKey}:${notificationDay(now)}` :
            `applications:${companyKey}:${s.applications_seen_until.toISOString()}:${now.toISOString()}`,
          payload: applicationsEmail([...counts.values()], owner.email, appUrl),
        });
      }
    }
    await client.query(`UPDATE company_notification_settings SET applications_seen_until=GREATEST(applications_seen_until,$2),
      last_digest_on=CASE WHEN application_mode='digest' THEN $3::date ELSE last_digest_on END WHERE company_key=$1`,
    [companyKey, now, notificationDay(now)]);
  }
  if (!instantOnly && s.deadline_reminders) {
    // Lock jobs before invoices, matching manual ordering/moderation. Recheck under
    // that lock so concurrent orders cannot race the one-pending constraint.
    const jobs = (await client.query(`SELECT j.id,j.published->>'title' title,
        j.placement_tier,j.placement_expires_at
      FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id
      JOIN company_profiles p ON p.company_key=o.company_key
      WHERE o.company_key=$1 AND p.approval_status='approved' AND j.status='published'
        AND j.placement_tier IN ('vip','premium')
        AND j.placement_expires_at>$2 AND j.placement_expires_at<=$2::timestamptz+interval '3 days'
      ORDER BY j.id FOR UPDATE OF j`, [companyKey, now])).rows;
    for (const job of jobs) {
      const blocked = (await client.query(`SELECT 1 FROM job_invoices WHERE job_id=$1
        AND (status='pending' OR renewal_for_expires_at=$2
          OR (status='paid' AND activated_at IS NULL)) LIMIT 1`, [job.id, job.placement_expires_at])).rowCount;
      if (blocked) continue;
      const invoice = await createInvoiceDetails(client, {
        id: job.id, company: owner.name, title: job.title, billingEmail: owner.email,
        placement: job.placement_tier, renewalForExpiresAt: job.placement_expires_at,
      });
      await enqueue(client, { kind: 'deadline',
        dedupeKey: `placement-renewal:${job.id}:${job.placement_expires_at.toISOString()}`,
        payload: placementRenewalEmail(invoice, job.title, job.placement_expires_at, owner.email, appUrl) });
      await client.query(`INSERT INTO audit_log(job_id,action,actor,after_data)
        VALUES($1,'placement.renewal_requested','system',$2)`,
      [job.id, { invoiceNumber: invoice.number, expiresAt: job.placement_expires_at }]);
    }
  }
  return queued;
}

/** Cancellation must also run for disabled owners/settings and unapproved companies. */
async function cancelExpiredRenewals(now: Date, options: { companyKey?: string; jobId?: string }) {
  await transaction(async c => {
    const jobs = (await c.query(`SELECT j.id FROM jobs j
      WHERE ($1::text IS NULL OR EXISTS (SELECT 1 FROM company_job_ownership o WHERE o.job_id=j.id AND o.company_key=$1))
        AND ($2::uuid IS NULL OR j.id=$2)
        AND EXISTS (SELECT 1 FROM job_invoices i WHERE i.job_id=j.id AND i.status='pending'
          AND i.renewal_for_expires_at<=$3::timestamptz-interval '7 days')
      ORDER BY j.id FOR UPDATE`, [options.companyKey ?? null, options.jobId ?? null, now])).rows;
    for (const job of jobs) {
      const invoices = (await c.query(`UPDATE job_invoices SET status='cancelled'
        WHERE job_id=$1 AND status='pending' AND renewal_for_expires_at<=$2::timestamptz-interval '7 days'
        RETURNING id,renewal_for_expires_at`, [job.id, now])).rows;
      for (const invoice of invoices) {
        await c.query(`INSERT INTO audit_log(job_id,action,actor,after_data)
          VALUES($1,'placement.renewal_cancelled','system',$2)`, [job.id, { invoiceId: invoice.id }]);
        await c.query(`UPDATE notification_emails SET status='cancelled',locked_until=NULL
          WHERE dedupe_key=$1 AND status IN ('pending','sending')`,
        [`placement-renewal:${job.id}:${invoice.renewal_for_expires_at.toISOString()}`]);
      }
    }
  });
}

export type NotificationJobOptions = { companyKey?: string; jobId?: string; instantOnly?: boolean; deliver?: boolean };
export async function runNotificationJobs(now = new Date(), options: NotificationJobOptions = {}) {
  if (!options.instantOnly) await cancelExpiredRenewals(now, options);
  const companies = (await db().query<{ company_key: string }>(`SELECT p.company_key FROM company_profiles p
    WHERE ($1::text IS NULL OR p.company_key=$1)
      AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM company_job_ownership o WHERE o.company_key=p.company_key AND o.job_id=$2))
      AND EXISTS(SELECT 1 FROM company_accounts a WHERE a.company_key=p.company_key AND a.role='owner' AND a.enabled AND a.email_verified)`,
  [options.companyKey ?? null, options.jobId ?? null])).rows;
  let queued = 0;
  for (const company of companies) queued += await transaction(c => queueCompany(c, company.company_key, now, !!options.instantOnly));
  // C6 integration point: call the admin-review queuer here, before delivery.
  if (!options.instantOnly && !options.companyKey && !options.jobId) await queueAdminNotifications(now);
  const delivery = options.deliver === false ? { sent: 0, failed: 0, disabled: true } : await deliverNotifications();
  return { queued, ...delivery };
}

import { queueAdminNotifications } from './admin-notifications';
export { queueAdminNotifications } from './admin-notifications';

// Best effort callback for after(): a failed scan must never reject an application.
export async function notifyApplication(options: { companyKey?: string; jobId?: string }) {
  if (!options.companyKey && !options.jobId) return;
  try { await runNotificationJobs(new Date(), { ...options, instantOnly: true }); }
  catch { console.warn('Application notification deferred'); }
}
