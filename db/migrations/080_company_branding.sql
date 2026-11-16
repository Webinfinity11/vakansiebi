ALTER TABLE company_profiles ADD COLUMN cover_url text NOT NULL DEFAULT '';
ALTER TABLE company_profiles ADD COLUMN benefits jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(benefits)='array' AND jsonb_array_length(benefits)<=12);
ALTER TABLE company_profiles ADD COLUMN why_us text NOT NULL DEFAULT '' CHECK(length(why_us)<=1500);
ALTER TABLE company_profiles ADD COLUMN cv_box_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE company_cover_images (
 hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'),
 company_key text NOT NULL REFERENCES company_profiles(company_key) ON DELETE CASCADE,
 data bytea NOT NULL CHECK(octet_length(data)<=2097152),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE company_cv_uploads ADD COLUMN source text NOT NULL DEFAULT 'upload' CHECK(source IN ('upload','cv_box'));
ALTER TABLE company_cv_uploads ADD COLUMN client_hash text;
ALTER TABLE company_cv_uploads ADD COLUMN consent_at timestamptz;
CREATE INDEX company_cv_box_rate ON company_cv_uploads(client_hash,created_at) WHERE source='cv_box';
CREATE UNIQUE INDEX company_cv_box_email ON company_cv_uploads(company_key,lower(email)) WHERE source='cv_box' AND email<>'';
