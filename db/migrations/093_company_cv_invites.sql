CREATE TABLE company_cv_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
  upload_id uuid NOT NULL UNIQUE REFERENCES company_cv_uploads(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  consented_at timestamptz,
  consent_version text,
  withdrawn_at timestamptz
);
ALTER TABLE company_candidate_states DROP CONSTRAINT company_candidate_states_entry_check;
ALTER TABLE company_candidate_states ADD CONSTRAINT company_candidate_states_entry_check CHECK (entry ~ '^(swipe|upload):[0-9a-f-]{36}$|^resume:[0-9a-f-]{36}:[0-9a-f-]{36}$|^base:[rsu]:[0-9a-f-]{36}$');
ALTER TABLE company_candidate_refs DROP CONSTRAINT company_candidate_refs_entry_check;
ALTER TABLE company_candidate_refs ADD CONSTRAINT company_candidate_refs_entry_check CHECK (entry ~ '^base:[rsu]:[0-9a-f-]{36}$');
ALTER TABLE company_saved_candidates DROP CONSTRAINT company_saved_candidates_entry_check;
ALTER TABLE company_saved_candidates ADD CONSTRAINT company_saved_candidates_entry_check CHECK (entry ~ '^upload:[0-9a-f-]{36}$|^base:[rsu]:[0-9a-f-]{36}$');
ALTER TABLE company_cv_base_views DROP CONSTRAINT company_cv_base_views_entry_check;
ALTER TABLE company_cv_base_views ADD CONSTRAINT company_cv_base_views_entry_check CHECK (entry ~ '^base:[rsu]:[0-9a-f-]{36}$');
-- Also clean references when the owner deletes its upload (the invite cascades).
CREATE FUNCTION clean_cv_invite_references() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM company_candidate_refs WHERE entry='base:u:'||OLD.upload_id;
  DELETE FROM company_saved_candidates WHERE entry='base:u:'||OLD.upload_id;
  DELETE FROM company_candidate_states WHERE entry='base:u:'||OLD.upload_id;
  DELETE FROM company_candidate_notes WHERE entry='base:u:'||OLD.upload_id;
  DELETE FROM company_cv_profiles WHERE entry='base:u:'||OLD.upload_id;
  DELETE FROM company_cv_base_views WHERE entry='base:u:'||OLD.upload_id;
  RETURN OLD;
END;
$$;
CREATE TRIGGER clean_cv_invite_references AFTER DELETE OR UPDATE OF withdrawn_at ON company_cv_invites
FOR EACH ROW EXECUTE FUNCTION clean_cv_invite_references();
-- Rollback: DROP TABLE company_cv_invites; DROP FUNCTION clean_cv_invite_references();
-- Remove base:u rows from the four constrained tables, then restore their [rs] checks from 087/089/091/092.
