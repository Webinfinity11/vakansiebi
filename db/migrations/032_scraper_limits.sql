ALTER TABLE sources
  ADD COLUMN batch_limit integer NOT NULL DEFAULT 200 CHECK(batch_limit BETWEEN 1 AND 200),
  ADD COLUMN budget_minutes integer NOT NULL DEFAULT 8 CHECK(budget_minutes BETWEEN 1 AND 8),
  ADD COLUMN discovery_page_limit integer NOT NULL DEFAULT 3 CHECK(discovery_page_limit BETWEEN 0 AND 3),
  ADD COLUMN repair_limit integer NOT NULL DEFAULT 20 CHECK(repair_limit BETWEEN 0 AND 20);
UPDATE sources SET batch_limit=100,budget_minutes=5 WHERE id IN ('hrgov','worknet');
