-- Which JOBX-built CV reached which of our own vacancies. A row exists only when the reader
-- holds a CV saved on JOBX (proved by its delete token) and pressed send-CV, call or apply on
-- a vacancy an employer posted through JOBX. Deleting the CV or the vacancy removes the row.
CREATE TABLE IF NOT EXISTS resume_contacts (
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id uuid NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cv', 'call', 'apply')),
  presses integer NOT NULL DEFAULT 1,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, resume_id, kind)
);
CREATE INDEX IF NOT EXISTS resume_contacts_job_last ON resume_contacts (job_id, last_at DESC);
