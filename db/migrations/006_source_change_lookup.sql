CREATE INDEX IF NOT EXISTS audit_source_change_lookup_idx
ON audit_log(job_id,created_at DESC) WHERE action='source.changed';
