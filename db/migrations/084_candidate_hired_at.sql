-- Historical hires intentionally retain an unknown hire date.
ALTER TABLE company_candidate_states ADD COLUMN hired_at timestamptz;
