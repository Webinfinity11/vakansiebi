CREATE TABLE company_message_templates (
  company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('received','interview','information','rejected','accepted')),
  subject text NOT NULL CHECK (length(btrim(subject)) > 0 AND length(subject) <= 200),
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 5000),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_key, kind)
);
