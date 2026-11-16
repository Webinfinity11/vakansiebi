ALTER TABLE company_accounts DROP CONSTRAINT company_accounts_company_key_key;
ALTER TABLE company_accounts ADD COLUMN role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','recruiter','viewer'));
CREATE UNIQUE INDEX company_one_owner ON company_accounts(company_key) WHERE role='owner';
CREATE TABLE company_team_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_key text NOT NULL REFERENCES company_profiles(company_key),
 email text NOT NULL, role text NOT NULL CHECK(role IN ('recruiter','viewer')),
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL DEFAULT now()+interval '72 hours',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_key,email)
);
