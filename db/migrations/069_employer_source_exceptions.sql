-- An admin may approve the employer's own source while retaining an older
-- company-wide restriction on third-party boards. Both source and URL host
-- must match; merely changing a snapshot's source label does not bypass it.
ALTER TABLE employer_suppressions ADD COLUMN allowed_source_hosts text[] NOT NULL DEFAULT '{}';

CREATE FUNCTION employer_source_allowed(v jsonb, hosts text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(v->>'source','')=ANY(hosts)
    AND coalesce(v->>'url','') LIKE 'https://%'
    AND split_part(split_part(coalesce(v->>'url',''),'https://',2),'/',1)=ANY(hosts)
$$;

CREATE OR REPLACE FUNCTION employer_suppression_for(v jsonb) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT s.id FROM employer_suppressions s WHERE s.active AND (
    employer_removal_key(v->>'company')=ANY(s.company_keys)
    OR v->>'url'=ANY(s.source_urls)
    OR s.email IN (SELECT lower(m[1]) FROM regexp_matches(v::text,
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}', 'g') m)
  ) AND NOT employer_source_allowed(v,s.allowed_source_hosts)
  ORDER BY s.created_at,s.id LIMIT 1
$$;

-- Preserve the original sticky restriction, including edited company names.
-- Only an explicitly approved source may release a stored suppression ID.
CREATE OR REPLACE FUNCTION enforce_employer_suppression() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.employer_suppression_id := coalesce(
    (SELECT id FROM employer_suppressions WHERE id=NEW.employer_suppression_id AND active
      AND NOT employer_source_allowed(NEW.draft,allowed_source_hosts)),
    employer_suppression_for(NEW.draft), employer_suppression_for(NEW.published)
  );
  IF NEW.employer_suppression_id IS NOT NULL THEN
    NEW.status := 'rejected';
    NEW.published := NULL;
    NEW.automation_paused := true;
    NEW.automation_reason := 'employer_opt_out';
    NEW.needs_review := false;
  END IF;
  RETURN NEW;
END $$;
