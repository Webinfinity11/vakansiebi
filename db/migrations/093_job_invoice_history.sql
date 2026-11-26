-- Keep invoice history, but allow only one payable order per vacancy.
SET LOCAL lock_timeout = '3s';
ALTER TABLE job_invoices DROP CONSTRAINT IF EXISTS job_invoices_job_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS job_invoices_one_pending_per_job
  ON job_invoices(job_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS job_invoices_job_created_idx
  ON job_invoices(job_id,created_at DESC);
