-- A submission the admin marks as a test stays in the list but leaves every count:
-- submissions, performance, form analytics and income.
ALTER TABLE job_submissions ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
