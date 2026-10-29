-- Multiple-employer vacancy portal; enable after a live parsing check.
INSERT INTO sources(id,name,enabled,auto_enabled,auto_publish,interval_minutes,retired)
VALUES ('infobatumi','infobatumi.ge',false,false,false,180,false)
ON CONFLICT (id) DO NOTHING;
