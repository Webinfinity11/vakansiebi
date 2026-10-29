CREATE TABLE IF NOT EXISTS job_alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  filter_key text NOT NULL,
  filters jsonb NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','unsubscribed')),
  nonce uuid NOT NULL DEFAULT gen_random_uuid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cursor_at timestamptz NOT NULL DEFAULT now(),
  next_digest_at timestamptz NOT NULL DEFAULT now()+interval '1 day',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email,filter_key)
);
CREATE INDEX IF NOT EXISTS job_alert_due_idx ON job_alert_subscriptions(next_digest_at) WHERE status='active';
CREATE INDEX IF NOT EXISTS job_alert_email_idx ON job_alert_subscriptions(email,requested_at);
CREATE TABLE IF NOT EXISTS job_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES job_alert_subscriptions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('confirmation','digest')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  first_attempt_at timestamptz,
  locked_until timestamptz,
  lease_token uuid,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  provider_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_alert_delivery_due_idx ON job_alert_deliveries(next_attempt_at) WHERE status IN ('pending','sending');
CREATE TABLE IF NOT EXISTS job_alert_seen (
  subscription_id uuid NOT NULL REFERENCES job_alert_subscriptions(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(subscription_id,group_key)
);
