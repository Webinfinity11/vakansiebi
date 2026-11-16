CREATE TABLE company_job_drafts (
  id uuid PRIMARY KEY,
  company_key text NOT NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  form jsonb NOT NULL,
  step smallint NOT NULL DEFAULT 1,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_job_drafts_company_idx ON company_job_drafts(company_key, updated_at DESC);
CREATE UNIQUE INDEX company_job_drafts_job_idx ON company_job_drafts(job_id) WHERE job_id IS NOT NULL;
