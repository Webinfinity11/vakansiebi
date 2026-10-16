-- General enquiries are distinct from opening an email to apply with a CV.
-- Historical CV counts cannot be split retrospectively.
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_kind_check;
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_kind_check
  CHECK (kind IN ('search','search_empty','view','outbound','filter','save','saved_search','application',
                  'call','cv','email','apply','post','resume','action'));
