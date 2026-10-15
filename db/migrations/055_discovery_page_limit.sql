-- Date-ordered listings stop on their own once they pass the import window, and
-- jobs.ss.ge repeats today's postings in each of three paid tiers ~55 pages deep,
-- so the admin page limit goes up to 60 (lib/scraper-limits.ts).
ALTER TABLE sources DROP CONSTRAINT IF EXISTS sources_discovery_page_limit_check;
ALTER TABLE sources ADD CONSTRAINT sources_discovery_page_limit_check
  CHECK (discovery_page_limit BETWEEN 0 AND 60);
