CREATE TABLE IF NOT EXISTS company_cv_profiles (
  company_key text NOT NULL,
  entry text NOT NULL,
  text text NOT NULL DEFAULT '',
  parsed jsonb,
  edited jsonb NOT NULL DEFAULT '{}',
  method text NOT NULL DEFAULT 'rules-v1',
  parsed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_key, entry)
);
