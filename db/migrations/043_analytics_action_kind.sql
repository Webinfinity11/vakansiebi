-- Which public control a reader used (share, load more, hide, report…) or which
-- error they met, recorded only as a code name. Nothing identifies a person or
-- a vacancy; these are counts of presses, not journeys.
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_kind_check;
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_kind_check
  CHECK (kind IN ('search','search_empty','view','outbound','filter','save','saved_search','application',
                  'call','cv','apply','post','resume','action'));
