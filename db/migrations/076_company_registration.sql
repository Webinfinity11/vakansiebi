ALTER TABLE company_profiles ADD COLUMN registration_code text UNIQUE CHECK (registration_code ~ '^[0-9]{9}$');
ALTER TABLE company_profiles ADD COLUMN approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending','approved','rejected'));
ALTER TABLE company_accounts ADD COLUMN representative_name text NOT NULL DEFAULT '';
ALTER TABLE company_accounts ADD COLUMN position text NOT NULL DEFAULT '';
ALTER TABLE company_accounts ADD COLUMN phone text NOT NULL DEFAULT '';
ALTER TABLE company_accounts ADD COLUMN email_verified boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX company_accounts_email ON company_accounts(lower(email));
CREATE TABLE company_email_tokens (
 token_hash text PRIMARY KEY, account_id uuid NOT NULL REFERENCES company_accounts(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours'
);
-- Publication remains protected even through an administrator or another publication path.
CREATE FUNCTION check_company_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='published' AND EXISTS (
 SELECT 1 FROM company_job_ownership o JOIN company_profiles p USING(company_key)
 WHERE o.job_id=NEW.id AND (p.approval_status<>'approved' OR NOT EXISTS (
 SELECT 1 FROM company_accounts a WHERE a.company_key=p.company_key AND a.email_verified AND a.enabled))) THEN
 RAISE EXCEPTION 'Company approval and email verification required';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER company_publication_approval BEFORE INSERT OR UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION check_company_publication();
