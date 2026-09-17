ALTER TABLE sources ADD COLUMN processing_mode text NOT NULL DEFAULT 'economical'
  CHECK (processing_mode IN ('economical','full'));
-- NULL means unmeasured historical data, never zero attempts.
ALTER TABLE source_runs ADD COLUMN metrics jsonb;
ALTER TABLE source_runs ADD COLUMN run_kind text NOT NULL DEFAULT 'legacy'
  CHECK (run_kind IN ('legacy','discovery','repair'));
