-- Counts which filters are used, saves, saved searches and application stage changes.
-- Values are code names or vacancy ids only, never text the reader typed.
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_kind_check;
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_kind_check
  CHECK (kind IN ('search','search_empty','view','outbound','filter','save','saved_search','application'));
