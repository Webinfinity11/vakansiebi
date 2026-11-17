-- Who opened a JOBX CV base person's contact or CV, and when. The CV base is open to every
-- approved company; this record shows how each one uses it.
CREATE TABLE company_cv_base_views (
  id bigserial PRIMARY KEY,
  company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  account_id uuid REFERENCES company_accounts(id) ON DELETE SET NULL,
  entry text NOT NULL CHECK (entry ~ '^base:[rs]:[0-9a-f-]{36}$'),
  kind text NOT NULL CHECK (kind IN ('contact','cv')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_cv_base_views_company ON company_cv_base_views(company_key, created_at DESC);
CREATE INDEX company_cv_base_views_entry ON company_cv_base_views(company_key, entry);
-- Rollback: DROP TABLE company_cv_base_views;
