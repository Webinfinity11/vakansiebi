-- One row per CV sent from hr@jobx.ge through the quick-choice deck (/swipe).
-- The candidate is known by the hashed address they used; a failed send frees
-- the vacancy for another attempt, a sent or in-flight one does not.
CREATE TABLE swipe_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_key text NOT NULL CHECK (candidate_key ~ '^[a-f0-9]{64}$'),
  candidate_name text NOT NULL CHECK (length(candidate_name) BETWEEN 1 AND 120),
  candidate_email text NOT NULL CHECK (length(candidate_email) BETWEEN 3 AND 254),
  candidate_phone text NOT NULL DEFAULT '' CHECK (length(candidate_phone) <= 32),
  client_hash text NOT NULL CHECK (client_hash ~ '^[a-f0-9]{64}$'),
  resume_id uuid,
  cv_kind text NOT NULL CHECK (cv_kind IN ('upload','jobx')),
  recipient text NOT NULL CHECK (length(recipient) BETWEEN 3 AND 254),
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed')),
  provider_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE UNIQUE INDEX swipe_applications_once_idx ON swipe_applications(job_id, candidate_key)
  WHERE status <> 'failed';
CREATE INDEX swipe_applications_candidate_idx ON swipe_applications(candidate_key, created_at);
CREATE INDEX swipe_applications_client_idx ON swipe_applications(client_hash, created_at);
