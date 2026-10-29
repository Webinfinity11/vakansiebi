CREATE TABLE company_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key text NOT NULL UNIQUE REFERENCES company_profiles(company_key),
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  email text NOT NULL,
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE company_sessions (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES company_accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_sessions_account ON company_sessions(account_id);
CREATE TABLE company_login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  network_hash text NOT NULL,
  username_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_login_attempts_time ON company_login_attempts(created_at);
CREATE TABLE company_job_ownership (
  job_id uuid PRIMARY KEY REFERENCES jobs(id),
  company_key text NOT NULL REFERENCES company_profiles(company_key),
  assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_job_ownership_company ON company_job_ownership(company_key);
