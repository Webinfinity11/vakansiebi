-- Matching a query word against every description is the one search cost left,
-- and it is the whole catalogue: 20 MB of text read and scanned per request.
-- A trigram index answers the same LIKE in milliseconds. Measured on production
-- (PostgreSQL 18, C.UTF-8): 597ms → 3ms for one Georgian word, 987ms → 17ms for
-- a word with its reviewed equivalents, and 92ms for a two-word search.
-- pg_trgm hashes multibyte trigrams, so Georgian is indexed like any other text
-- as long as the database classifies its letters as word characters; where it
-- does not — a macOS libc build, for one — the index simply stays unused and the
-- reader gets the same rows from a scan.
-- The facet and relaxed counts still visit every visible row, but only its small
-- maintained scalars; nothing here changes what a search matches.
-- The extension lives in public and its operator class is named unqualified
-- below, so the search path has to reach it: a replay into a schema of its own —
-- which is how the integration tests apply this file — starts with only that
-- schema, and IF NOT EXISTS then skips an extension installed elsewhere.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '300s';
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
SELECT set_config('search_path', current_setting('search_path') || ', public', true);
CREATE INDEX IF NOT EXISTS jobs_search_document_trgm
  ON jobs USING gin (search_document gin_trgm_ops)
  WHERE status = 'published';
ANALYZE jobs;
