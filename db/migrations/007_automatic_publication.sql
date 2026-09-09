ALTER TABLE sources ADD COLUMN auto_publish boolean NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN automation_managed boolean NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN automation_paused boolean NOT NULL DEFAULT false;
ALTER TABLE jobs ADD COLUMN automation_reason text;
ALTER TABLE jobs ADD COLUMN automation_checked_at timestamptz;
ALTER TABLE source_items ADD COLUMN last_verified_at timestamptz;
UPDATE jobs j SET automation_paused=true WHERE EXISTS(SELECT 1 FROM audit_log a WHERE a.job_id=j.id AND a.actor='admin');
UPDATE source_items SET last_verified_at=last_checked_at WHERE raw IS NOT NULL AND error IS NULL;
CREATE INDEX jobs_automation_idx ON jobs(updated_at,id) WHERE NOT automation_paused AND status IN ('pending','published','archived');
