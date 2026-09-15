CREATE TABLE IF NOT EXISTS job_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('expired', 'wrong', 'duplicate', 'other')),
  note text CHECK (length(note) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS job_reports_resolved_created_idx
  ON job_reports (resolved_at, created_at);
