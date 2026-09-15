CREATE TABLE billing_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  payee_name text NOT NULL,
  bank_name text NOT NULL,
  iban text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE job_invoices (
  id uuid PRIMARY KEY,
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  token text NOT NULL UNIQUE,
  job_id uuid NOT NULL UNIQUE REFERENCES jobs(id),
  amount_gel integer NOT NULL CHECK(amount_gel>0),
  service_days integer NOT NULL CHECK(service_days>0),
  payer_name text NOT NULL,
  vacancy_title text NOT NULL,
  payee_name text NOT NULL,
  bank_name text NOT NULL,
  iban text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled','refund_required','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  activated_at timestamptz,
  refunded_at timestamptz
);
CREATE INDEX job_invoices_status_idx ON job_invoices(status,created_at);
