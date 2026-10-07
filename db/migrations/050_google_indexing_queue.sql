CREATE TABLE IF NOT EXISTS google_indexing_queue (
  url text PRIMARY KEY,
  job_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('URL_UPDATED', 'URL_DELETED')),
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'rejected')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  locked_until timestamptz,
  last_http_status integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS google_indexing_queue_due_idx
  ON google_indexing_queue(available_at, created_at) WHERE status = 'pending';
