-- The interview belongs to this company's application state, not the public resume.
ALTER TABLE company_candidate_states
  ADD COLUMN interview_at timestamptz,
  ADD COLUMN interview_note text;
