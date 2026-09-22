CREATE TABLE resumes (
  id uuid PRIMARY KEY,
  delete_token_hash text NOT NULL,
  cv jsonb NOT NULL CHECK (NOT cv ? 'photo'),
  photo bytea CHECK (octet_length(photo) <= 120000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '12 months'
);
CREATE INDEX resumes_expires_at ON resumes(expires_at);
CREATE INDEX resumes_created_at ON resumes(created_at DESC, id);
