-- Login attempts are counted per client as well as in total, so one address cannot lock the admin out.
-- `client` holds a keyed hash of the address, never the address itself.
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS client text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS login_attempts_client_time_idx ON login_attempts(client, created_at);
