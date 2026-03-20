-- ============================================================================
-- CAMPAIGN AUTO-EXPIRY — pg_cron daily at 11:59 PM IST (18:29 UTC)
-- ============================================================================
-- Marks campaigns as 'expired' when the current date is past their end_date.
-- Only updates campaigns that are currently 'active'.
-- ============================================================================

-- Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Function: expire campaigns past their end_date
CREATE OR REPLACE FUNCTION public.expire_ended_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count INT;
BEGIN
  UPDATE public.campaigns
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE;

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  IF expired_count > 0 THEN
    RAISE NOTICE '[expire_ended_campaigns] Expired % campaign(s)', expired_count;
  END IF;
END;
$$;

-- Schedule: daily at 11:59 PM IST = 18:29 UTC
-- Remove existing job if present (safe re-run)
SELECT cron.unschedule('daily-campaign-expiry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-campaign-expiry');

SELECT cron.schedule(
  'daily-campaign-expiry',
  '29 18 * * *',
  'SELECT public.expire_ended_campaigns()'
);

-- ============================================================================
-- VERIFY
-- ============================================================================
-- Check cron is scheduled:
--   SELECT * FROM cron.job WHERE jobname = 'daily-campaign-expiry';
--
-- Test manually:
--   SELECT public.expire_ended_campaigns();
-- ============================================================================
