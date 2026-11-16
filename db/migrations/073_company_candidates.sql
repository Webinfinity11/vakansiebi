-- Hiring workspace for companies (/company → კანდიდატები, CV ბაზა).
-- An application stays in the table it arrived in: swipe_applications (a CV sent from JOBX),
-- resume_contacts (a JOBX-built CV sent to a vacancy) or company_cv_uploads (a CV the company
-- added itself). The company's own judgement about it lives here, keyed by an entry text:
--   swipe:<application id> · resume:<job id>:<resume id> · upload:<upload id>
CREATE TABLE company_candidate_states (
  company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  entry text NOT NULL CHECK (entry ~ '^(swipe|upload):[0-9a-f-]{36}$|^resume:[0-9a-f-]{36}:[0-9a-f-]{36}$'),
  stage text NOT NULL DEFAULT 'new'
    CHECK (stage IN ('new','review','shortlist','interview','offer','hired','rejected')),
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_key, entry)
);
CREATE TABLE company_candidate_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  entry text NOT NULL,
  author text NOT NULL CHECK (length(author) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_candidate_notes_entry ON company_candidate_notes(company_key, entry, created_at);
-- CVs a company uploads into its own base. The file is kept in private Blob storage when it is
-- configured, otherwise in the row itself (bounded to 5 MB), so local work needs no external store.
CREATE TABLE company_cv_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email text NOT NULL DEFAULT '' CHECK (length(email) <= 254),
  phone text NOT NULL DEFAULT '' CHECK (length(phone) <= 32),
  title text NOT NULL DEFAULT '' CHECK (length(title) <= 120),
  file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  file_hash text NOT NULL CHECK (file_hash ~ '^[a-f0-9]{64}$'),
  file_size integer NOT NULL CHECK (file_size BETWEEN 1 AND 5242880),
  blob_path text,
  content bytea CHECK (octet_length(content) <= 5242880),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (blob_path IS NOT NULL OR content IS NOT NULL),
  UNIQUE (company_key, file_hash)
);
CREATE INDEX company_cv_uploads_company ON company_cv_uploads(company_key, created_at DESC);
