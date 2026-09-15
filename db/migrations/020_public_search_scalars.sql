-- Public facets and duplicate grouping read these scalars for the whole catalogue.
-- STORED values move repeated JSON decompression to snapshot writes; changes by
-- the importer or moderation fill them automatically. Draft preview stays live.
-- IF NOT EXISTS also permits replay after a schema restore without its ledger.
-- The migration runner wraps this file in a transaction. Bound both the wait for
-- the table lock and the rewrite; failure rolls back so the migration can retry.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS search_title text GENERATED ALWAYS AS (published->>'title') STORED,
  ADD COLUMN IF NOT EXISTS search_company text GENERATED ALWAYS AS (published->>'company') STORED,
  ADD COLUMN IF NOT EXISTS search_city text GENERATED ALWAYS AS (published->>'city') STORED,
  ADD COLUMN IF NOT EXISTS search_category text GENERATED ALWAYS AS (published->>'category') STORED,
  ADD COLUMN IF NOT EXISTS search_date_posted text GENERATED ALWAYS AS (published->>'datePosted') STORED,
  ADD COLUMN IF NOT EXISTS search_deadline text GENERATED ALWAYS AS (published->>'deadline') STORED,
  ADD COLUMN IF NOT EXISTS search_mode text GENERATED ALWAYS AS (published->>'mode') STORED,
  ADD COLUMN IF NOT EXISTS search_salary text GENERATED ALWAYS AS (published->>'salary') STORED,
  ADD COLUMN IF NOT EXISTS search_currency text GENERATED ALWAYS AS (published->>'currency') STORED,
  ADD COLUMN IF NOT EXISTS search_salary_period text GENERATED ALWAYS AS (published->>'salaryPeriod') STORED,
  ADD COLUMN IF NOT EXISTS search_salary_min jsonb GENERATED ALWAYS AS (published->'salaryMin') STORED;
-- Relaxed counts/facets still need every visible row, so an extra filter index
-- cannot remove this scan. Existing source, fingerprint and logo indexes remain.
ANALYZE jobs;
