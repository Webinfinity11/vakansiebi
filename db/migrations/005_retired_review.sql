UPDATE jobs j SET needs_review=false
WHERE j.status='archived'
AND EXISTS(SELECT 1 FROM source_items i JOIN sources s ON s.id=i.source_id WHERE i.job_id=j.id AND s.retired)
AND NOT EXISTS(SELECT 1 FROM source_items i JOIN sources s ON s.id=i.source_id WHERE i.job_id=j.id AND NOT s.retired);
