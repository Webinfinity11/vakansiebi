-- What a listing page already says about a vacancy (jobs.ge work location and category),
-- merged into the parsed detail when the detail page itself is silent.
ALTER TABLE source_items ADD COLUMN IF NOT EXISTS listing_hints jsonb;
-- The large boards no longer re-read every detail four times a day. Listing presence is the
-- cheap liveness signal; a detail is re-read daily, and sooner once it has left the listings.
UPDATE sources SET detail_interval_hours=24 WHERE id IN ('hr','jobs','ss') AND detail_interval_hours=6;
-- Two JSON-backed boards verified on 2026-09-12: the state employment agency's public API
-- (robots.txt on the web host allows everything; the API host answers 401 for robots.txt,
-- which RFC 9309 treats as "no restrictions") and myjobs.ge's public vacancy API.
INSERT INTO sources(id,name,interval_minutes,detail_interval_hours,auto_publish)
VALUES ('worknet','worknet.moh.gov.ge',30,24,true),('myjobs','myjobs.ge',30,24,true)
ON CONFLICT (id) DO NOTHING;
