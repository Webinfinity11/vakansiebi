ALTER TABLE source_items ADD COLUMN IF NOT EXISTS refresh_requested_at timestamptz;
ALTER TABLE source_items ADD COLUMN IF NOT EXISTS refresh_completed_at timestamptz;
CREATE INDEX IF NOT EXISTS source_items_refresh_queue ON source_items(source_id,next_check_at) WHERE refresh_requested_at IS NOT NULL AND (refresh_completed_at IS NULL OR refresh_requested_at>refresh_completed_at);
