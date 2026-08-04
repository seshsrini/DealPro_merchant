-- ============================================================================
-- CAMPAIGN AUTO-EXPIRY — pg_cron, hourly
-- ============================================================================
-- Marks campaigns 'expired' once the IST date has moved PAST their end_date.
-- A deal is valid THROUGH its end_date (last valid day), so it expires at IST
-- midnight of the following day. The condition is IST-aware and therefore SAFE
-- TO RUN AT ANY TIME — a manual mid-day run can never expire a still-valid deal.
-- Runs hourly so a deal flips within an hour of IST midnight and a missed run is
-- self-healing. Only touches rows currently 'active'.
--
-- NOTE (defence in depth): the consumer feed functions ALSO filter
-- end_date >= today (IST), so an expired deal never reaches a consumer even in
-- the window before this cron flips its status. The merchant's active/expired
-- tabs read the status column, so they depend on this cron.
-- ============================================================================

-- pg_cron must already be enabled (Supabase Dashboard -> Database -> Extensions).
-- We intentionally do NOT run `CREATE EXTENSION pg_cron` / GRANTs here: on Supabase
-- that re-triggers pg_cron's internal grant script and fails with
-- "2BP01: dependent privileges exist". cron.schedule() below works with the
-- default postgres privileges once the extension is enabled.

-- Function: expire campaigns whose last valid day (end_date) has passed in IST.
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
    -- Strictly-less-than the IST "today": a deal valid till Aug 12 expires at
    -- Aug 13 00:00 IST, and this is safe to evaluate at any hour of the day.
    AND end_date < (now() AT TIME ZONE 'Asia/Kolkata')::date;

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  IF expired_count > 0 THEN
    RAISE NOTICE '[expire_ended_campaigns] Expired % campaign(s)', expired_count;
  END IF;
END;
$$;

-- Schedule: hourly (top of the hour). Remove any prior job first (safe re-run) —
-- including the legacy daily job name this replaces.
SELECT cron.unschedule('daily-campaign-expiry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-campaign-expiry');
SELECT cron.unschedule('hourly-campaign-expiry')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hourly-campaign-expiry');

SELECT cron.schedule(
  'hourly-campaign-expiry',
  '0 * * * *',
  'SELECT public.expire_ended_campaigns()'
);

-- Backfill immediately so the current expired backlog flips right now.
SELECT public.expire_ended_campaigns();

-- ============================================================================
-- VERIFY
-- ============================================================================
-- Check cron is scheduled:
--   SELECT * FROM cron.job WHERE jobname = 'daily-campaign-expiry';
--
-- Test manually:
--   SELECT public.expire_ended_campaigns();
-- ============================================================================
