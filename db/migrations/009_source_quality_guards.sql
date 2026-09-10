ALTER TABLE source_items
 ADD COLUMN quality_candidate jsonb,
 ADD COLUMN quality_signature text,
 ADD COLUMN quality_warning text,
 ADD COLUMN quality_first_seen timestamptz,
 ADD COLUMN quality_last_seen timestamptz,
 ADD COLUMN quality_observations integer NOT NULL DEFAULT 0;
ALTER TABLE sources
 ADD COLUMN quality_warning text,
 ADD COLUMN reported_total_candidate integer,
 ADD COLUMN reported_total_first_seen timestamptz,
 ADD COLUMN reported_total_last_seen timestamptz,
 ADD COLUMN reported_total_observations integer NOT NULL DEFAULT 0;
