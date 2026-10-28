-- Keep only the evidence needed for company pages, independently of vacancy cleanup.
-- No backfill: existing published/archived jobs are read alongside this history.
CREATE TABLE employer_page_history (
  job_id uuid PRIMARY KEY,
  snapshot jsonb NOT NULL,
  sources text[] NOT NULL
);

CREATE FUNCTION remember_employer_page(p_job_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE j jobs; v jsonb; source_ids text[];
BEGIN
  SELECT * INTO j FROM jobs WHERE id=p_job_id;
  v := CASE WHEN j.status='published' THEN j.published
            WHEN j.status='archived' AND j.published_at IS NOT NULL THEN coalesce(j.published,j.draft) END;
  IF v IS NULL OR coalesce(v->>'company','')='' OR j.employer_suppression_id IS NOT NULL THEN RETURN; END IF;
  SELECT array_agg(DISTINCT source_id ORDER BY source_id) INTO source_ids FROM source_items WHERE job_id=p_job_id;
  IF source_ids IS NULL THEN RETURN; END IF;
  INSERT INTO employer_page_history(job_id,snapshot,sources)
  VALUES(p_job_id,jsonb_build_object(
    'company',v->>'company','logoUrl',v->>'logoUrl','city',v->>'city',
    'title',v->>'title','category',v->>'category','url',v->>'url',
    -- Retain suppression matching without retaining the full job description.
    'emails',(SELECT jsonb_agg(DISTINCT lower(m[1])) FROM regexp_matches(v::text,
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}', 'g') m)
  ),source_ids)
  ON CONFLICT(job_id) DO NOTHING;
END $$;

CREATE FUNCTION preserve_employer_page() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.status='published' AND NEW.published IS NOT NULL THEN RETURN NEW; END IF;
  PERFORM remember_employer_page(OLD.id);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
-- Capture the last public evidence before archive clears published.
CREATE TRIGGER preserve_employer_page BEFORE UPDATE OF status,published OR DELETE ON jobs
FOR EACH ROW EXECUTE FUNCTION preserve_employer_page();

CREATE FUNCTION preserve_source_employer_page() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.job_id IS NOT NULL THEN PERFORM remember_employer_page(OLD.job_id); END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
-- Purge detaches source items before deleting jobs, including pre-migration archives.
CREATE TRIGGER preserve_source_employer_page BEFORE UPDATE OF job_id OR DELETE ON source_items
FOR EACH ROW EXECUTE FUNCTION preserve_source_employer_page();
