ALTER TABLE employer_decisions
  ADD COLUMN automatic boolean NOT NULL DEFAULT false,
  ADD COLUMN evidence jsonb;
