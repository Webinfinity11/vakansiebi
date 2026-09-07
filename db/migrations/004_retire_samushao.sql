ALTER TABLE sources ADD COLUMN IF NOT EXISTS retired boolean NOT NULL DEFAULT false;
UPDATE sources SET enabled=false,auto_enabled=false,retired=true,requested_at=NULL WHERE id='samushao';
-- Retain reversible historical/audit records. Mixed-source vacancies remain available.
WITH affected AS (
 SELECT j.id,j.status FROM jobs j
 WHERE j.status NOT IN ('archived','merged')
 AND EXISTS (SELECT 1 FROM source_items si WHERE si.job_id=j.id AND si.source_id='samushao')
 AND NOT EXISTS (SELECT 1 FROM source_items si WHERE si.job_id=j.id AND si.source_id<>'samushao')
), audited AS (
 INSERT INTO audit_log(job_id,action,actor,before_data,after_data)
 SELECT id,'source.retired','migration:004',jsonb_build_object('status',status),jsonb_build_object('status','archived','source','samushao') FROM affected
 RETURNING job_id
)
UPDATE jobs SET status='archived',version=version+1,updated_at=now() WHERE id IN (SELECT job_id FROM audited);
