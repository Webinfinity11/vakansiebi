-- All previously issued invoices were premium, including the old 20 GEL price.
-- Preserve their contracted amount, duration and activation; label new VIP orders explicitly.
SET LOCAL lock_timeout = '3s';
ALTER TABLE job_invoices ADD COLUMN placement_tier text NOT NULL DEFAULT 'premium'
  CHECK (placement_tier IN ('vip','premium'));
