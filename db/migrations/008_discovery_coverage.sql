ALTER TABLE sources ADD COLUMN discovery_cursor integer NOT NULL DEFAULT 0;
ALTER TABLE sources ADD COLUMN reported_total integer;
ALTER TABLE sources ADD COLUMN reported_pages integer;
ALTER TABLE sources ADD COLUMN discovery_observed_at timestamptz;
CREATE TABLE source_discovery_pages (
  source_id text NOT NULL REFERENCES sources(id),
  url text NOT NULL,
  signature text NOT NULL,
  item_count integer NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source_id,url)
);
CREATE INDEX source_items_unparsed_idx ON source_items(source_id,next_check_at,discovered_at,id) WHERE raw IS NULL;
CREATE INDEX source_items_recheck_idx ON source_items(source_id,next_check_at) WHERE raw IS NOT NULL;
