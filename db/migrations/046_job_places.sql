-- Precise workplaces for the vacancy map. Only an address the geocoder matched to one
-- building (house number, street and city) gets a row; everything else stays off the map.
CREATE TABLE IF NOT EXISTS geocode_cache (
  query text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('exact', 'ambiguous', 'none')),
  lat double precision,
  lon double precision,
  label text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS job_places (
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  query text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  label text NOT NULL,
  PRIMARY KEY (job_id, query)
);
-- Which vacancies have been read for an address, and from what text, so an unchanged one
-- is never parsed or geocoded twice.
CREATE TABLE IF NOT EXISTS job_place_checks (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  source text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
