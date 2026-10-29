-- An employer's complete careers page; activation follows the first live validation.
INSERT INTO sources(id,name,enabled,auto_enabled,auto_publish,interval_minutes,retired)
VALUES ('mushebi','mushebi.ge',false,false,false,180,false)
ON CONFLICT (id) DO NOTHING;
