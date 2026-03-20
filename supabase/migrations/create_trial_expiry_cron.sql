-- ============================================================================
-- TRIAL EXPIRY AUTOMATED WARNINGS
-- pg_cron + pg_net → send-trial-email Edge Function
-- ============================================================================
-- Runs daily at 10:00 AM UTC. Finds merchants whose current_period_end
-- (trial end) is exactly 3 days away with status = 'active'.
-- Calls the send-trial-email Edge Function via net.http_post for each.
-- Uses last_notified_at on merchant_subscriptions to prevent duplicates.
-- ============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Grant permissions for cron execution
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
GRANT USAGE ON SCHEMA net TO postgres;

-- 3. Add last_notified_at column to merchant_subscriptions (prevents duplicate warnings)
ALTER TABLE public.merchant_subscriptions
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.merchant_subscriptions.last_notified_at IS
  'Timestamp of the last trial expiry warning sent. Used by pg_cron to prevent duplicate 3-day warnings.';

-- 4. Core function: find expiring trials and call the Edge Function
CREATE OR REPLACE FUNCTION public.notify_upcoming_trial_ends()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Hardcoded project URL and service role key
  -- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY below with your actual key from
  -- Supabase Dashboard → Settings → API → Service Role Key
  edge_function_url := 'https://gkulyxglzqlhpqxlwjqw.supabase.co/functions/v1/send-trial-email';
  service_role_key := 'YOUR_SERVICE_ROLE_KEY';

  -- Select merchants whose trial ends in exactly 3 days
  -- Window: 2.5 – 3.5 days to handle timing edge cases around the 10 AM run
  FOR r IN
    SELECT
      ms.id                AS subscription_id,
      ms.merchant_id,
      ms.plan_name,
      ms.current_period_end,
      COALESCE(ms.total_recurring_amount, st.subscription_fee, 0) AS total_recurring_amount,
      COALESCE(st.tier_name, ms.plan_name)                        AS tier_name,
      COALESCE(st.currency, 'INR')                                 AS currency
    FROM public.merchant_subscriptions ms
    LEFT JOIN public.subscription_tiers st ON st.tier_key = ms.plan_name
    WHERE ms.status = 'active'
      AND ms.cancel_at_period_end = false
      AND ms.current_period_end IS NOT NULL
      AND ms.current_period_end >= (NOW() + INTERVAL '2 days 12 hours')
      AND ms.current_period_end <  (NOW() + INTERVAL '3 days 12 hours')
      -- Skip if we already notified this subscription
      AND ms.last_notified_at IS NULL
  LOOP
    RAISE NOTICE '[notify_upcoming_trial_ends] Trial warning → merchant: %, plan: %, amount: %',
      r.merchant_id, r.plan_name, r.total_recurring_amount;

    -- Call send-trial-email Edge Function via pg_net (non-blocking)
    PERFORM net.http_post(
      url     := edge_function_url,
      body    := json_build_object(
        'merchant_id',            r.merchant_id,
        'subscription_id',        r.subscription_id,
        'total_recurring_amount', r.total_recurring_amount,
        'plan_name',              r.plan_name,
        'tier_name',              r.tier_name,
        'currency',               r.currency,
        'trial_end',              r.current_period_end
      )::jsonb,
      headers := json_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || service_role_key
      )::jsonb
    );

    -- Also insert into user_notifications for in-app display
    INSERT INTO public.user_notifications (
      user_id, type, title, body, merchant_id
    ) VALUES (
      r.merchant_id::uuid,
      'trial_expiry_3day',
      'Your DealPro trial ends in 3 days!',
      'Your first payment of ' || r.currency ||
        r.total_recurring_amount::text ||
        ' will be processed soon. Enjoy your remaining trial days with ' ||
        r.tier_name || ' plan.',
      r.merchant_id::uuid
    );

  END LOOP;
END;
$$;

-- 5. Schedule the cron job: daily at 10:00 AM UTC
-- Remove existing jobs if present (safe re-run)
SELECT cron.unschedule('daily-trial-check')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-trial-check');

SELECT cron.unschedule('daily-trial-reminder')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-trial-reminder');

SELECT cron.schedule(
  'daily-trial-reminder',
  '0 10 * * *',
  'SELECT public.notify_upcoming_trial_ends()'
);

-- ============================================================================
-- SETUP INSTRUCTIONS
-- ============================================================================
-- Prerequisites:
--   1. Enable pg_cron and pg_net from Dashboard → Database → Extensions
--   2. Replace YOUR_SERVICE_ROLE_KEY in the function above with your actual key
--      (Dashboard → Settings → API → Service Role Key)
--
-- Deploy the Edge Function:
--   supabase functions deploy send-trial-email
--
-- Test manually:
--   SELECT public.notify_upcoming_trial_ends();
--
-- Verify cron is scheduled:
--   SELECT * FROM cron.job WHERE jobname = 'daily-trial-reminder';
-- ============================================================================
