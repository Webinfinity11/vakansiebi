-- Keep fresh installations and newly added sources on the economical cadence.
-- Preserve any deliberately slower source settings.
ALTER TABLE sources ALTER COLUMN interval_minutes SET DEFAULT 180;
UPDATE sources SET interval_minutes=180
WHERE NOT retired AND interval_minutes<180;
