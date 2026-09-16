-- What a vacancy calls itself — its title, employer and city — is where a search
-- now looks first, so it needs the index the description already has. Kept as its
-- own column rather than read from the three scalars, because a trigram index
-- answers one expression and the reader asks for exactly this one.
-- Same immutability rule as migration 027: || over COALESCE, normalize once.
-- Measured on production: 585ms → 350ms for a role word with its equivalents.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '300s';
SELECT set_config('search_path', current_setting('search_path') || ', public', true);
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS search_headline text GENERATED ALWAYS AS (
    lower(normalize(
      COALESCE(published->>'title', '') || ' ' ||
      COALESCE(published->>'company', '') || ' ' ||
      COALESCE(published->>'city', ''), NFKC))) STORED;
CREATE INDEX IF NOT EXISTS jobs_search_headline_trgm
  ON jobs USING gin (search_headline gin_trgm_ops)
  WHERE status = 'published';
ANALYZE jobs;
