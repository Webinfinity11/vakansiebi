INSERT INTO sources(id,name,interval_minutes)
VALUES ('ss','jobs.ss.ge',30),('hrgov','vacancy.hr.gov.ge',60)
ON CONFLICT (id) DO NOTHING;
