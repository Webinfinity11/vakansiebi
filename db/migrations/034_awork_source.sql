-- Opt-in source: adding the adapter must not start collection automatically.
INSERT INTO sources(id,name,enabled,auto_enabled,interval_minutes,retired)
VALUES ('awork','awork.ge',false,false,180,false)
ON CONFLICT (id) DO NOTHING;
