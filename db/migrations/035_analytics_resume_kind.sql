-- How far a reader gets in the CV builder, which options they choose,
-- and where they stop before printing, recorded only as step codes.
-- Nothing identifies a person; these are counts, not journeys.
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_kind_check;
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_kind_check
  CHECK (kind IN ('search','search_empty','view','outbound','filter','save','saved_search','application',
                  'call','cv','apply','post','resume'));
