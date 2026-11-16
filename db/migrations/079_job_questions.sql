-- Private preferred answers never appear in the public questions endpoint.
CREATE TABLE company_job_questions (
 job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
 questions jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(questions)='array' AND jsonb_array_length(questions)<=5),
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Snapshot text, answer and comparison survive later changes to the questionnaire.
ALTER TABLE swipe_applications ADD COLUMN question_answers jsonb NOT NULL DEFAULT '[]';
