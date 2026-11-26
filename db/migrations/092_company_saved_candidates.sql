CREATE TABLE company_saved_candidates (
  company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  entry text NOT NULL CHECK (entry ~ '^upload:[0-9a-f-]{36}$|^base:[rs]:[0-9a-f-]{36}$'),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_key, entry)
);
-- Rollback: DROP TABLE company_saved_candidates;
