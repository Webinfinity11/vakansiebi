CREATE TABLE sources (
 id text PRIMARY KEY, name text NOT NULL, enabled boolean NOT NULL DEFAULT true,
 auto_enabled boolean NOT NULL DEFAULT true,
 interval_minutes integer NOT NULL DEFAULT 30 CHECK (interval_minutes BETWEEN 15 AND 1440),
 detail_interval_hours integer NOT NULL DEFAULT 6 CHECK(detail_interval_hours BETWEEN 1 AND 168),
 last_started_at timestamptz, last_success_at timestamptz, next_run_at timestamptz NOT NULL DEFAULT now(),
 last_error text, consecutive_failures integer NOT NULL DEFAULT 0, requested_at timestamptz,
 sitemap_cursor integer NOT NULL DEFAULT 0
);
CREATE TABLE jobs (
 id uuid PRIMARY KEY, draft jsonb NOT NULL, published jsonb,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','archived','rejected','merged')),
 needs_review boolean NOT NULL DEFAULT true, fingerprint text NOT NULL,
 version integer NOT NULL DEFAULT 1, merged_into uuid REFERENCES jobs(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz
);
CREATE INDEX jobs_status_idx ON jobs(status);
CREATE INDEX jobs_fingerprint_idx ON jobs(fingerprint);
CREATE INDEX jobs_published_at_idx ON jobs(published_at DESC) WHERE status='published';
CREATE TABLE source_items (
 id uuid PRIMARY KEY, source_id text NOT NULL REFERENCES sources(id), external_id text NOT NULL,
 url text NOT NULL, job_id uuid REFERENCES jobs(id), raw jsonb, content_hash text,
 discovered_at timestamptz NOT NULL DEFAULT now(),last_seen_at timestamptz NOT NULL DEFAULT now(),
 last_checked_at timestamptz,next_check_at timestamptz NOT NULL DEFAULT now(),error text,
 failures integer NOT NULL DEFAULT 0, UNIQUE(source_id,external_id)
);
CREATE INDEX source_items_job_idx ON source_items(job_id);
CREATE INDEX source_items_queue_idx ON source_items(source_id,next_check_at);
CREATE TABLE source_runs (
 id uuid PRIMARY KEY,source_id text NOT NULL REFERENCES sources(id),started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,status text NOT NULL DEFAULT 'running',discovered integer NOT NULL DEFAULT 0,
 imported integer NOT NULL DEFAULT 0,changed integer NOT NULL DEFAULT 0,failed integer NOT NULL DEFAULT 0,error text
);
CREATE INDEX source_runs_recent_idx ON source_runs(started_at DESC);
CREATE TABLE audit_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,job_id uuid REFERENCES jobs(id),
 action text NOT NULL,actor text NOT NULL,before_data jsonb,after_data jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE login_attempts (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX login_attempts_time_idx ON login_attempts(created_at);
