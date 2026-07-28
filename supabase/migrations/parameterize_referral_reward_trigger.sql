-- Parameterize the merchant referral-reward trigger.
--
-- The original process_merchant_referral() hardcoded the DEV project URL
-- (gkulyxglzqlhpqxlwjqw) and read the service-role key from
-- app.settings.service_role_key (a GUC Supabase rejects). So in PROD it called
-- the WRONG project with no auth. Route it through the app_config helpers
-- (edge_function_url / app_secret_get) and GUARD the pg_net dispatch so a missing
-- URL/key or queue error can NEVER abort a merchant signup — this fires
-- AFTER INSERT ON merchant_profiles, and a throwing trigger there blocks signup
-- (same failure mode as the earlier campaigns-notification outage).
--
-- Prereqs (apply create_app_config.sql first, and per project):
--   app_configs.project_ref                → the project's ref
--   app_configs.referral_reward_threshold  → {"count": N}   (already present)
--   app_configs.referral_reward_offer_id   → {"offer_id":"offer_xxx"}  (once created in Razorpay)
--   Vault secret 'service_role_key'         → for app_secret_get()

CREATE OR REPLACE FUNCTION public.process_merchant_referral()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  referrer_merchant_id VARCHAR(255);
  ref_count INT;
  threshold INT;
  fn_url  TEXT;
  svc_key TEXT;
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO referrer_merchant_id
  FROM public.merchant_profiles
  WHERE merchant_referral_code = NEW.invite_code
    AND id != NEW.id
  LIMIT 1;

  IF referrer_merchant_id IS NULL THEN
    RAISE NOTICE '[process_merchant_referral] No merchant found with referral code %', NEW.invite_code;
    RETURN NEW;
  END IF;

  -- Record the referral (one row per referee).
  INSERT INTO public.merchant_referrals (referrer_id, referee_id, referral_code_used, status, qualified_at)
  VALUES (referrer_merchant_id, NEW.id, NEW.invite_code, 'qualified', now())
  ON CONFLICT (referee_id) DO NOTHING;

  -- Count this referrer's qualified referrals for the current calendar month.
  SELECT COUNT(*) INTO ref_count
  FROM public.merchant_referrals
  WHERE referrer_id = referrer_merchant_id
    AND status = 'qualified'
    AND qualified_at >= date_trunc('month', now())
    AND qualified_at <  date_trunc('month', now()) + INTERVAL '1 month';

  SELECT (config_value->>'count')::INT INTO threshold
  FROM public.app_configs WHERE config_key = 'referral_reward_threshold';
  IF threshold IS NULL THEN threshold := 20; END IF;

  -- Threshold hit and not already rewarded this month → dispatch the reward.
  IF ref_count >= threshold
     AND NOT EXISTS (
       SELECT 1 FROM public.merchant_rewards_log
       WHERE merchant_id = referrer_merchant_id
         AND reward_month = date_trunc('month', now())::DATE
     )
  THEN
    fn_url  := public.edge_function_url('process-referral-reward');
    svc_key := public.app_secret_get('service_role_key');

    IF fn_url IS NOT NULL AND svc_key IS NOT NULL THEN
      -- pg_net is async, but wrap defensively so nothing here can abort the signup.
      BEGIN
        PERFORM net.http_post(
          url     := fn_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || svc_key
          ),
          body    := jsonb_build_object(
            'merchant_id', referrer_merchant_id,
            'subscription_id', (
              SELECT id FROM public.merchant_subscriptions
              WHERE merchant_id = referrer_merchant_id AND status = 'active'
              ORDER BY created_at DESC LIMIT 1
            )
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[process_merchant_referral] reward dispatch failed for %: %', referrer_merchant_id, SQLERRM;
      END;
    ELSE
      RAISE WARNING '[process_merchant_referral] edge_function_url/service_role_key not configured — skipping reward dispatch for %', referrer_merchant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
