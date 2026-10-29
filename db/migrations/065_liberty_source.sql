-- Official employer board. Activation is separate from adding support.
INSERT INTO sources(id,name,enabled,auto_enabled,auto_publish,interval_minutes,retired)
VALUES ('liberty','libertybank.ge',false,false,false,180,false)
ON CONFLICT (id) DO NOTHING;
