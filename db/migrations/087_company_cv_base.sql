-- The JOBX CV base: companies may track people from it (base:r:<resume> for resumes built on
-- JOBX, base:s:<swipe application> for a CV uploaded with a swipe application).
ALTER TABLE company_candidate_states DROP CONSTRAINT company_candidate_states_entry_check;
ALTER TABLE company_candidate_states ADD CONSTRAINT company_candidate_states_entry_check CHECK (
  entry ~ '^(swipe|upload):[0-9a-f-]{36}$|^resume:[0-9a-f-]{36}:[0-9a-f-]{36}$|^base:[rs]:[0-9a-f-]{36}$'
);
-- Rollback: delete states whose entry starts with 'base:', then restore the 073 check.
