-- Classified vacancy board. Only the vacancy category is collected; the neighbouring
-- job-seeker, student and internship categories of the same board are not.
-- Collection starts enabled, publication stays manual until the catalogue owner has
-- reviewed real imported records, because these advertisements carry no employer entity.
INSERT INTO sources(id,name,interval_minutes,detail_interval_hours,auto_publish)
VALUES ('gancxadebebi','gancxadebebi.ge',60,24,false)
ON CONFLICT (id) DO NOTHING;
