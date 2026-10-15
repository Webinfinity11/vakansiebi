-- A daily walk of a board's full listing notices vacancies the board removed early.
-- An imported vacancy missing from two complete walks is treated as removed.
ALTER TABLE source_items ADD COLUMN IF NOT EXISTS missing_since timestamptz;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS removal_swept_at timestamptz;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS removal_sweep_count integer;
