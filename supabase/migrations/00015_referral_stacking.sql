-- Referral reward update: threshold 10 + STACKING.
-- Old behaviour: 1 free month per calendar month once you hit the threshold.
-- New behaviour: 1 free month per 10 qualified referrals in the month (20 → 2, …).
-- Run in DEV + PROD. NOTE: the pg_net URL below is the DEV project — change the
-- ref to lpypcdshtiwkxkelepnl when running on PROD.

UPDATE public.app_configs
SET config_value = '{ "count": 10 }'::jsonb
WHERE config_key = 'referral_reward_threshold';

CREATE OR REPLACE FUNCTION public.process_merchant_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_merchant_id VARCHAR(255);
  ref_count INT;
  threshold INT;
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO referrer_merchant_id
  FROM public.merchant_profiles
  WHERE merchant_referral_code = NEW.invite_code AND id != NEW.id
  LIMIT 1;

  IF referrer_merchant_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.merchant_referrals (referrer_id, referee_id, referral_code_used, status, qualified_at)
  VALUES (referrer_merchant_id, NEW.id, NEW.invite_code, 'qualified', now())
  ON CONFLICT (referee_id) DO NOTHING;

  SELECT COUNT(*) INTO ref_count
  FROM public.merchant_referrals
  WHERE referrer_id = referrer_merchant_id
    AND status = 'qualified'
    AND qualified_at >= date_trunc('month', now())
    AND qualified_at <  date_trunc('month', now()) + INTERVAL '1 month';

  SELECT (config_value->>'count')::INT INTO threshold
  FROM public.app_configs
  WHERE config_key = 'referral_reward_threshold';
  IF threshold IS NULL OR threshold <= 0 THEN
    threshold := 10;
  END IF;

  -- STACKING: grant one free month each time the count crosses a multiple of the
  -- threshold (10 → 1st, 20 → 2nd, …). The trigger fires once per qualified
  -- referral, so the modulo hits exactly once per multiple — each = one grant.
  IF ref_count > 0 AND (ref_count % threshold) = 0 THEN
    PERFORM net.http_post(
      url := 'https://gkulyxglzqlhpqxlwjqw.supabase.co/functions/v1/process-referral-reward',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'merchant_id', referrer_merchant_id,
        'referral_count', ref_count,
        'subscription_id', (
          SELECT id FROM public.merchant_subscriptions
          WHERE merchant_id = referrer_merchant_id AND status = 'active'
          ORDER BY created_at DESC LIMIT 1
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
