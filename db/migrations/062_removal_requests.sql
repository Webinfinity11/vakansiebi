CREATE TABLE employer_removal_requests (
  id uuid PRIMARY KEY,
  source_id text NOT NULL UNIQUE,
  message_id text UNIQUE,
  sender text NOT NULL,
  source text NOT NULL CHECK(source IN ('email','link','admin')),
  subject text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  company_names text[] NOT NULL DEFAULT '{}',
  status text NOT NULL CHECK(status IN ('review','removed','ignored')),
  note text NOT NULL DEFAULT '',
  suppression_id uuid REFERENCES employer_suppressions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  confirmation jsonb,
  confirmation_status text CHECK(confirmation_status IN ('pending','sending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  provider_id text,
  last_error text,
  confirmed_at timestamptz
);
CREATE INDEX employer_removal_requests_pending_idx ON employer_removal_requests(next_attempt_at)
  WHERE confirmation_status IN ('pending','sending');
CREATE INDEX swipe_applications_recipient_idx ON swipe_applications(lower(recipient));
