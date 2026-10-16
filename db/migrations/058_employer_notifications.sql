-- Private employer contact data. Legacy submissions may have no email;
-- new submissions require it in the shared form/API schema.
ALTER TABLE job_submissions ADD COLUMN notification_email text
  CHECK (notification_email IS NULL OR (length(notification_email) BETWEEN 3 AND 254 AND notification_email !~ '[[:cntrl:]]'));

UPDATE job_submissions s SET notification_email=e.payload->'to'->>0
FROM job_invoices i JOIN invoice_email_delivery e ON e.invoice_id=i.id
WHERE i.job_id=s.job_id AND length(e.payload->'to'->>0) BETWEEN 3 AND 254;

UPDATE job_submissions s SET notification_email=(
  SELECT f->>'value' FROM jsonb_array_elements(j.draft->'facts') f
  WHERE f->>'label'='ელფოსტა CV-სთვის'
    AND length(f->>'value') BETWEEN 3 AND 254 AND f->>'value' !~ '[[:cntrl:]]'
  LIMIT 1
) FROM jobs j WHERE j.id=s.job_id AND s.notification_email IS NULL;

CREATE TABLE publication_email_delivery (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX publication_email_delivery_pending_idx ON publication_email_delivery(next_attempt_at)
  WHERE status IN ('pending','sending');
-- Deliberately do not queue retrospective mail for already published vacancies.

CREATE TABLE employer_contact_notes (
  company_key text PRIMARY KEY CHECK (length(company_key) BETWEEN 1 AND 300),
  notes text NOT NULL DEFAULT '' CHECK (length(notes)<=4000),
  last_contacted_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
