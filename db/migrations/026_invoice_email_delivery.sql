CREATE TABLE invoice_email_delivery (
  invoice_id uuid PRIMARY KEY REFERENCES job_invoices(id) ON DELETE CASCADE,
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
CREATE INDEX invoice_email_delivery_pending_idx ON invoice_email_delivery(next_attempt_at)
  WHERE status IN ('pending','sending');
