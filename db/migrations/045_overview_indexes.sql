-- The admin overview counts automatic archiving per day; without this it would read the whole
-- audit log, which the importers grow by thousands of rows a day.
CREATE INDEX IF NOT EXISTS audit_log_archived_time_idx ON audit_log(created_at) WHERE action = 'automation.archived';
