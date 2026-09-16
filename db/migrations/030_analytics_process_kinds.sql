-- What the two sides of the site actually do, beyond looking: a reader pressing
-- call, opening a letter with a CV, or leaving for the employer's own form; and
-- an employer filling the posting form — which section they reached, what the
-- form refused, and where they stopped when they never sent it.
-- Values stay what they always were: a vacancy id, or a code name of a step.
-- Nothing identifies a person; these are counts, not journeys.
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_kind_check;
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_kind_check
  CHECK (kind IN ('search','search_empty','view','outbound','filter','save','saved_search','application',
                  'call','cv','apply','post'));
