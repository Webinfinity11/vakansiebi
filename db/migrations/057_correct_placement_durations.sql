-- Correct the original 14-day terms: paid premium is 30 days, free VIP is 15.
-- Keep the original activation time, payment history and job publication state.
-- Only untouched old expiries are extended; an admin's later override is preserved.
WITH original AS MATERIALIZED (
  SELECT i.id AS invoice_id, i.job_id, i.activated_at,
         j.placement_tier, j.placement_expires_at AS old_expires_at
  FROM job_invoices i JOIN jobs j ON j.id=i.job_id
  WHERE i.service_days=14 AND i.amount_gel=20 AND i.status IN ('pending','paid')
  FOR UPDATE OF j,i
), changed_jobs AS (
  UPDATE jobs j SET placement_expires_at=o.activated_at+interval '30 days',
    version=j.version+1, updated_at=now()
  FROM original o WHERE j.id=o.job_id AND o.placement_tier='premium'
    AND o.old_expires_at=o.activated_at+interval '14 days'
  RETURNING j.id,j.placement_expires_at
), changed_invoices AS (
  UPDATE job_invoices i SET service_days=30 FROM original o WHERE i.id=o.invoice_id
  RETURNING i.id
), unsent_email AS (
  -- A payload already attempted/sent must retain its provider idempotency content.
  -- Correct only mail which has never been attempted; do not resend anything.
  UPDATE invoice_email_delivery e SET payload=
    jsonb_set(jsonb_set(e.payload,'{html}',to_jsonb(replace(e.payload->>'html','· 14 დღე','· 30 დღე'))),
      '{text}',to_jsonb(replace(e.payload->>'text','· 14 დღე','· 30 დღე')))
  FROM changed_invoices i WHERE e.invoice_id=i.id
    AND e.status='pending' AND e.attempts=0 AND e.first_attempt_at IS NULL
  RETURNING e.invoice_id
)
INSERT INTO audit_log(job_id,action,actor,before_data,after_data)
SELECT o.job_id,'placement.duration-corrected','migration:057',
  jsonb_build_object('invoiceId',o.invoice_id,'tier','premium','days',14,'expiresAt',o.old_expires_at),
  jsonb_build_object('invoiceId',o.invoice_id,'tier','premium','days',30,
    'expiresAt',coalesce(j.placement_expires_at,o.old_expires_at))
FROM original o LEFT JOIN changed_jobs j ON j.id=o.job_id;

WITH original AS MATERIALIZED (
  SELECT j.id,j.placement_expires_at AS old_expires_at,a.created_at AS activated_at
  FROM jobs j JOIN job_submissions s ON s.job_id=j.id
  JOIN LATERAL (
    SELECT created_at,after_data FROM audit_log
    WHERE job_id=j.id AND action='placement.approved' AND after_data->>'tier'='vip'
    ORDER BY created_at DESC,id DESC LIMIT 1
  ) a ON true
  WHERE j.placement_tier='vip' AND s.bonus_company_key IS NOT NULL
    AND a.after_data->>'days'='14'
    AND j.placement_expires_at=a.created_at+interval '14 days'
  FOR UPDATE OF j
), changed AS (
  UPDATE jobs j SET placement_expires_at=o.activated_at+interval '15 days',
    version=j.version+1,updated_at=now()
  FROM original o WHERE j.id=o.id RETURNING j.id,j.placement_expires_at
)
INSERT INTO audit_log(job_id,action,actor,before_data,after_data)
SELECT o.id,'placement.duration-corrected','migration:057',
  jsonb_build_object('tier','vip','days',14,'expiresAt',o.old_expires_at),
  jsonb_build_object('tier','vip','days',15,'expiresAt',c.placement_expires_at)
FROM original o JOIN changed c ON c.id=o.id;
