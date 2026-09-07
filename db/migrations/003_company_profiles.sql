CREATE TABLE company_profiles (
 company_key text PRIMARY KEY,
 name text NOT NULL,
 logo_url text NOT NULL DEFAULT '',
 website text NOT NULL DEFAULT '',
 description text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
