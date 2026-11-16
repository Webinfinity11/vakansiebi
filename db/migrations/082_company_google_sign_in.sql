-- Google sign-in for company accounts. The Google subject id is stable even when
-- the account's email changes, so returning users are matched on it first.
-- Rollback: ALTER TABLE company_accounts DROP COLUMN google_sub;
ALTER TABLE company_accounts ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS company_accounts_google_sub ON company_accounts(google_sub) WHERE google_sub IS NOT NULL;
