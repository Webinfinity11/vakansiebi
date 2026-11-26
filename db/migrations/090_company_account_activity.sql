-- When a company last signed in and when it set its own password, for the admin.
ALTER TABLE company_accounts
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
-- Open sessions are the only earlier trace of a sign-in.
UPDATE company_accounts a SET last_login_at = s.seen
  FROM (SELECT account_id, max(last_seen_at) AS seen FROM company_sessions GROUP BY account_id) s
 WHERE s.account_id = a.id AND a.last_login_at IS NULL;
