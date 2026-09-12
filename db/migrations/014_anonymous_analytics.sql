-- Anonymous usage counts for the admin. An event is a kind, a value and a time: no IP address,
-- no cookie, no session and no user agent is stored, so no row can be traced to a person.
-- Raw events are kept for 30 days and then folded into daily totals by the worker's purge.
CREATE TABLE IF NOT EXISTS analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('search','search_empty','view','outbound')),
  value text NOT NULL CHECK (length(value) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_events_kind_time ON analytics_events (kind, created_at);
CREATE TABLE IF NOT EXISTS analytics_daily (
  day date NOT NULL,
  kind text NOT NULL,
  value text NOT NULL,
  count integer NOT NULL,
  PRIMARY KEY (day, kind, value)
);
