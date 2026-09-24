-- The admin history reads one vacancy's entries, or the rare entries people made, newest first.
-- Both would otherwise walk the whole log, which the importers fill by the thousand.
CREATE INDEX IF NOT EXISTS audit_log_job_history_idx ON audit_log(job_id, id DESC);
CREATE INDEX IF NOT EXISTS audit_log_people_idx ON audit_log(id DESC) WHERE actor IN ('admin','employer');
