-- One key for postings whose published text is identical: title, employer, city and
-- description, case and whitespace ignored. joob.ge reposts the same ad under a new id;
-- with no employer name such postings were never grouped, so each repost became its own
-- public page (181 identical pages in the sitemap on 2026-11-27). search-plan.ts groups
-- an unnamed employer's postings by this key; a lookup by id finds them through the index.
-- Generated columns cannot reference generated columns, so the published JSON
-- expressions are repeated (see 020/027/081).
-- Run BEFORE deploying the reader. The ALTER rewrites jobs under ACCESS EXCLUSIVE lock,
-- like 027 and 081; the runner's transaction rolls everything back on a timeout.
-- Rollback: revert the reader code, then DROP INDEX jobs_duplicate_key_idx;
-- ALTER TABLE jobs DROP COLUMN search_duplicate_key.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '300s';
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS search_duplicate_key text GENERATED ALWAYS AS (
    CASE WHEN published IS NULL THEN NULL ELSE md5(regexp_replace(lower(normalize(
      COALESCE(published->>'title','') || '|' || COALESCE(published->>'company','') || '|' ||
      COALESCE(published->>'city','') || '|' || COALESCE(published->>'description',''),NFKC)),
      '[[:space:]]+','','g')) END
  ) STORED;
CREATE INDEX IF NOT EXISTS jobs_duplicate_key_idx ON jobs(search_duplicate_key)
  WHERE status='published';
ANALYZE jobs;
