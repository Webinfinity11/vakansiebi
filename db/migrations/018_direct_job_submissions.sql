-- JOBX is a publication channel, never a crawler target.
INSERT INTO sources(id,name,enabled,auto_enabled,auto_publish,retired)
VALUES('jobx','JOBX',false,false,false,false) ON CONFLICT(id) DO NOTHING;
CREATE TABLE job_submissions (
  request_id uuid PRIMARY KEY,
  job_id uuid NOT NULL UNIQUE REFERENCES jobs(id),
  client_hash text NOT NULL,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_submissions_client_time_idx ON job_submissions(client_hash,created_at);
ALTER TABLE job_submissions ADD COLUMN requested_placement text NOT NULL DEFAULT 'standard' CHECK(requested_placement IN ('standard','vip','premium'));
-- Only moderation can claim the introductory benefit. One claim per normalized employer.
ALTER TABLE job_submissions ADD COLUMN bonus_company_key text UNIQUE;
ALTER TABLE jobs ADD COLUMN placement_tier text NOT NULL DEFAULT 'standard' CHECK(placement_tier IN ('standard','vip','premium'));
ALTER TABLE jobs ADD COLUMN placement_expires_at timestamptz;
