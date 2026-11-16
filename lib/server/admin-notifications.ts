import { safeEmail } from '../application-contact';
import { adminReviewEmail } from '../admin-review-email';
import { transaction } from './db';
import { queueNotification } from './notification-email';

type ReviewState = { since: string; day: string; sentToday: number };
export async function queueAdminNotifications(now = new Date()): Promise<void> {
  const recipient = safeEmail(process.env.ADMIN_NOTIFY_EMAIL || '');
  if (!recipient) return;
  const configured = Number(process.env.ADMIN_NOTIFY_DAILY_LIMIT);
  const limit = Number.isInteger(configured) && configured >= 1 && configured <= 24 ? configured : 4;
  const day = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' });
  await transaction(async c => {
    // Also serializes first-run INSERT, when there is no row to lock yet.
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended('notification:admin_review',0))");
    const state = (await c.query<{ value: ReviewState }>("SELECT value FROM notification_state WHERE key='admin_review' FOR UPDATE")).rows[0]?.value;
    if (!state) {
      await c.query("INSERT INTO notification_state(key,value) VALUES('admin_review',$1)", [{ since: now.toISOString(), day, sentToday: 0 }]);
      return;
    }
    const sentToday = state.day === day ? state.sentToday : 0;
    if (sentToday >= limit || now <= new Date(state.since)) return;
    const jobs = (await c.query(`SELECT j.draft->>'title' AS name FROM job_submissions s JOIN jobs j ON j.id=s.job_id
      WHERE NOT s.is_test AND j.status='pending' AND s.created_at>$1 AND s.created_at<=$2 ORDER BY s.created_at`, [state.since, now])).rows;
    const companies = (await c.query(`SELECT p.name FROM company_profiles p WHERE p.approval_status='pending'
      AND EXISTS(SELECT 1 FROM company_accounts a WHERE a.company_key=p.company_key AND a.role='owner' AND a.created_at>$1 AND a.created_at<=$2)
      ORDER BY p.company_key`, [state.since, now])).rows;
    const autoPublished = (await c.query(`SELECT COALESCE(j.published->>'title',j.draft->>'title') AS name FROM jobs j
      WHERE j.auto_published_at>$1 AND j.auto_published_at<=$2 AND j.auto_publish_reviewed_at IS NULL ORDER BY j.auto_published_at`, [state.since, now])).rows;
    if (!jobs.length && !companies.length && !autoPublished.length) return;
    await queueNotification(c, { kind: 'admin_review', dedupeKey: `admin:${day}:${sentToday + 1}`,
      payload: adminReviewEmail({ jobs: jobs.map(r => r.name), companies: companies.map(r => r.name), autoPublished: autoPublished.map(r => r.name) }, recipient, process.env.APP_URL || 'https://jobx.ge') });
    await c.query("UPDATE notification_state SET value=$1,updated_at=now() WHERE key='admin_review'", [{ since: now.toISOString(), day, sentToday: sentToday + 1 }]);
  });
}
