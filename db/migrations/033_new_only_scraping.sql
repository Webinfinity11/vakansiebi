-- One-time switch: retain IDs as tombstones; do not fetch the historical backlog.
-- Apply together with the new-only worker, never while old workers are running.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM sources WHERE lease_until > now()) THEN
    RAISE EXCEPTION 'Stop active source workers before enabling new-only collection';
  END IF;
END $$;
UPDATE source_items SET next_check_at='infinity'::timestamptz,
  refresh_requested_at=NULL,refresh_completed_at=NULL;
UPDATE sources SET repair_limit=0;
