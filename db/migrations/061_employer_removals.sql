CREATE TABLE employer_suppressions (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  company_names text[] NOT NULL DEFAULT '{}',
  company_keys text[] NOT NULL DEFAULT '{}',
  source_urls text[] NOT NULL DEFAULT '{}',
  reason text NOT NULL,
  evidence text NOT NULL DEFAULT '',
  actor text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR cardinality(company_keys)>0 OR cardinality(source_urls)>0)
);
ALTER TABLE jobs ADD COLUMN employer_suppression_id uuid REFERENCES employer_suppressions(id);
CREATE INDEX jobs_employer_suppression_idx ON jobs(employer_suppression_id) WHERE employer_suppression_id IS NOT NULL;
CREATE TABLE removed_vacancies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid UNIQUE REFERENCES jobs(id) ON DELETE SET NULL,
  suppression_id uuid NOT NULL REFERENCES employer_suppressions(id),
  snapshot jsonb NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX removed_vacancies_time_idx ON removed_vacancies(removed_at DESC,id DESC);

CREATE FUNCTION employer_removal_key(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT left(regexp_replace(lower(normalize(coalesce(value,''), NFKC)), '[^[:alnum:]]', '', 'g'),300)
$$;
CREATE FUNCTION employer_suppression_for(v jsonb) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT s.id FROM employer_suppressions s WHERE s.active AND (
    employer_removal_key(v->>'company')=ANY(s.company_keys)
    OR v->>'url'=ANY(s.source_urls)
    OR s.email IN (SELECT lower(m[1]) FROM regexp_matches(v::text,
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}', 'g') m)
  ) ORDER BY s.created_at,s.id LIMIT 1
$$;
-- Every publisher, including an older scraper process, passes through this guard.
CREATE FUNCTION enforce_employer_suppression() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.employer_suppression_id := coalesce(
    (SELECT id FROM employer_suppressions WHERE id=NEW.employer_suppression_id AND active),
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
CREATE TRIGGER aa_enforce_employer_suppression BEFORE INSERT OR UPDATE ON jobs
FOR EACH ROW EXECUTE FUNCTION enforce_employer_suppression();

CREATE FUNCTION record_removed_vacancy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.employer_suppression_id IS NOT NULL THEN
    INSERT INTO removed_vacancies(job_id,suppression_id,snapshot)
      VALUES(NEW.id,NEW.employer_suppression_id,NEW.draft)
      ON CONFLICT(job_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER record_removed_vacancy AFTER INSERT OR UPDATE ON jobs
FOR EACH ROW EXECUTE FUNCTION record_removed_vacancy();
