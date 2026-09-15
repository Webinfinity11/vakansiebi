-- Small, content-addressed employer logos. Bytes are never duplicated in job JSON.
CREATE TABLE submission_logos (
  hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'),
  content_type text NOT NULL CHECK(content_type IN ('image/png','image/jpeg','image/webp')),
  data bytea NOT NULL CHECK(octet_length(data) BETWEEN 1 AND 50000),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
