-- A company tracks a base CV by reference; the CV is never copied.
CREATE TABLE company_candidate_refs (
  company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  entry text NOT NULL CHECK (entry ~ '^base:[rs]:[0-9a-f-]{36}$'),
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_key, entry)
);
-- Rollback: DROP TABLE company_candidate_refs;
