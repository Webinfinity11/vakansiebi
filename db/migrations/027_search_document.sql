-- Every text search used to rebuild the same document — title, employer, city and
-- the whole description, lowercased and NFKC-normalized — for all twelve thousand
-- published rows, then carry it through a materialized CTE that spilled to disk.
-- Measured on a production copy: 1.3s for one query word against 0.16s for the
-- unfiltered list. These columns move that work to the snapshot write, exactly as
-- migration 020 did for the scalars; the reader only scans them.
-- The expressions must stay immutable: concat_ws is not, so the fields are joined
-- with || over COALESCE, and normalize() is applied once instead of the reader's
-- "IS NFKC NORMALIZED" shortcut. Both give the same text.
-- Draft preview keeps reading its live snapshot and gains nothing here.
-- The migration runner wraps this file in a transaction; the rewrite of a 73 MB
-- table needs more than the usual thirty seconds, and failure rolls back.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '300s';
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS search_document text GENERATED ALWAYS AS (
    lower(normalize(
      COALESCE(published->>'title', '') || ' ' ||
      COALESCE(published->>'company', '') || ' ' ||
      COALESCE(published->>'city', '') || ' ' ||
      COALESCE(published->>'description', ''), NFKC))) STORED,
  -- Only the "no experience required" filter reads the facts, and only when it is
  -- switched on; kept separate so an ordinary query never matches a fact label.
  ADD COLUMN IF NOT EXISTS search_facts text GENERATED ALWAYS AS (
    lower(normalize(COALESCE(published->>'facts', ''), NFKC))) STORED,
  ADD COLUMN IF NOT EXISTS search_employment_type text GENERATED ALWAYS AS (
    published->>'employmentType') STORED;
-- No text index: the facet and relaxed counts need every visible row anyway, so a
-- trigram index could not remove the scan it would have to be maintained for.
ANALYZE jobs;
