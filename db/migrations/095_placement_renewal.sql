-- Persist the period independently of notification delivery/retention.
SET LOCAL lock_timeout = '3s';
ALTER TABLE job_invoices ADD COLUMN renewal_for_expires_at timestamptz;
CREATE UNIQUE INDEX job_invoices_one_renewal_per_period
  ON job_invoices(job_id,renewal_for_expires_at)
  WHERE renewal_for_expires_at IS NOT NULL;
-- Retire already queued free-vacancy reminders; keep their history.
UPDATE notification_emails SET status='cancelled',locked_until=NULL
  WHERE kind='deadline' AND dedupe_key LIKE 'deadline:%' AND status IN ('pending','sending');
