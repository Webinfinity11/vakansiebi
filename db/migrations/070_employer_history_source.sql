-- Retain the source identity used by approved employer-source exceptions.
CREATE OR REPLACE FUNCTION remember_employer_page(p_job_id uuid) RETURNS void
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
    'title',v->>'title','category',v->>'category','url',v->>'url','source',v->>'source',
    -- Retain suppression matching without retaining the full job description.
    'emails',(SELECT jsonb_agg(DISTINCT lower(m[1])) FROM regexp_matches(v::text,
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}', 'g') m)
  ),source_ids)
  ON CONFLICT(job_id) DO NOTHING;
END $$;
