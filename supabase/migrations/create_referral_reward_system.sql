-- ═══════════════════════════════════════════════════════════════
-- REFERRAL REWARD SYSTEM
-- Merchant-to-merchant referral tracking with free month reward
-- ═══════════════════════════════════════════════════════════════

-- ── Phase 1: App Configs table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_configs (
  config_key TEXT PRIMARY KEY,
  config_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert the referral threshold (configurable — change count without code changes)
INSERT INTO public.app_configs (config_key, config_value)
VALUES ('referral_reward_threshold', '{ "count": 20 }')
ON CONFLICT (config_key) DO NOTHING;

-- ── Phase 3: Merchant Rewards Log (audit trail) ─────────────
CREATE TABLE IF NOT EXISTS public.merchant_rewards_log (
  id BIGSERIAL PRIMARY KEY,
  merchant_id VARCHAR(255) NOT NULL,
  reward_type VARCHAR(50) NOT NULL DEFAULT 'free_month',
  referral_count INT NOT NULL,
  reward_month DATE NOT NULL,          -- which calendar month earned it
  days_extended INT NOT NULL DEFAULT 30,
  old_end_date TIMESTAMPTZ,
  new_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rewards_log_merchant ON public.merchant_rewards_log(merchant_id);

-- ── Phase 3: grant_free_month function ──────────────────────
CREATE OR REPLACE FUNCTION public.grant_free_month(m_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sub RECORD;
  new_end TIMESTAMPTZ;
  old_end TIMESTAMPTZ;
  is_in_trial BOOLEAN;
BEGIN
  -- Find the merchant's active subscription
  SELECT * INTO sub
  FROM public.merchant_subscriptions
  WHERE merchant_id = m_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF sub IS NULL THEN
    RAISE NOTICE '[grant_free_month] No active subscription for merchant %', m_id;
    RETURN;
  END IF;

  -- Check if merchant is still in trial period
  is_in_trial := (sub.trial_end IS NOT NULL AND sub.trial_end > now());

  IF is_in_trial THEN
    -- Extend the trial_end by 30 days
    old_end := sub.trial_end;
    new_end := sub.trial_end + INTERVAL '30 days';

    UPDATE public.merchant_subscriptions
    SET trial_end = new_end,
        current_period_end = new_end,
        updated_at = now()
    WHERE id = sub.id;
  ELSE
    -- Extend the current_period_end by 30 days (paid period)
    old_end := sub.current_period_end;
    new_end := COALESCE(sub.current_period_end, now()) + INTERVAL '30 days';

    UPDATE public.merchant_subscriptions
    SET current_period_end = new_end,
        updated_at = now()
    WHERE id = sub.id;
  END IF;

  -- Audit log
  INSERT INTO public.merchant_rewards_log (merchant_id, reward_type, referral_count, reward_month, days_extended, old_end_date, new_end_date)
  VALUES (m_id, 'free_month', 20, date_trunc('month', now())::DATE, 30, old_end, new_end);

  RAISE NOTICE '[grant_free_month] Extended merchant % subscription by 30 days (% -> %)', m_id, old_end, new_end;
END;
$$;

-- ── Phase 2: process_merchant_referral trigger function ─────
-- When a new merchant signs up with an invite_code, the invite_code
-- matches an existing merchant's merchant_referral_code.
-- This trigger inserts into merchant_referrals and checks the reward threshold.
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
  -- Only process if the new merchant used an invite code
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    RETURN NEW;
  END IF;

  -- Find the referrer by their merchant_referral_code matching the invite_code
  SELECT id INTO referrer_merchant_id
  FROM public.merchant_profiles
  WHERE merchant_referral_code = NEW.invite_code
    AND id != NEW.id
  LIMIT 1;

  IF referrer_merchant_id IS NULL THEN
    RAISE NOTICE '[process_merchant_referral] No merchant found with referral code %', NEW.invite_code;
    RETURN NEW;
  END IF;

  -- Insert into merchant_referrals with status = 'qualified'
  INSERT INTO public.merchant_referrals (referrer_id, referee_id, referral_code_used, status, qualified_at)
  VALUES (referrer_merchant_id, NEW.id, NEW.invite_code, 'qualified', now())
  ON CONFLICT (referee_id) DO NOTHING;

  -- Count qualified referrals for this referrer in the current calendar month
  SELECT COUNT(*) INTO ref_count
  FROM public.merchant_referrals
  WHERE referrer_id = referrer_merchant_id
    AND status = 'qualified'
    AND qualified_at >= date_trunc('month', now())
    AND qualified_at < date_trunc('month', now()) + INTERVAL '1 month';

  -- Fetch the configurable threshold
  SELECT (config_value->>'count')::INT INTO threshold
  FROM public.app_configs
  WHERE config_key = 'referral_reward_threshold';

  IF threshold IS NULL THEN
    threshold := 20; -- fallback default
  END IF;

  -- If referrer hit the threshold, grant free month (only once per month)
  IF ref_count >= threshold THEN
    -- Check if already rewarded this month
    IF NOT EXISTS (
      SELECT 1 FROM public.merchant_rewards_log
      WHERE merchant_id = referrer_merchant_id
        AND reward_month = date_trunc('month', now())::DATE
    ) THEN
      -- Call the edge function via pg_net to defer Google Play billing + update DB.
      -- Target project comes from app.settings.project_ref (same convention as
      -- app.settings.service_role_key) so this runs unchanged on dev and prod:
      --   ALTER DATABASE postgres SET app.settings.project_ref = '<your-project-ref>';
      -- Unset → skip with a warning, never raise: a bad outbound call must not fail
      -- the signup that triggered it.
      IF coalesce(current_setting('app.settings.project_ref', true), '') = '' THEN
        RAISE WARNING '[referral-reward] app.settings.project_ref not set — skipping reward call for merchant %', referrer_merchant_id;
      ELSE
      PERFORM net.http_post(
        url := format('https://%s.supabase.co/functions/v1/process-referral-reward',
                      current_setting('app.settings.project_ref', true)),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'merchant_id', referrer_merchant_id,
          'subscription_id', (
            SELECT id FROM public.merchant_subscriptions
            WHERE merchant_id = referrer_merchant_id AND status = 'active'
            ORDER BY created_at DESC LIMIT 1
          )
        )
      );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Attach trigger to merchant_profiles inserts ─────────────
DROP TRIGGER IF EXISTS trg_process_merchant_referral ON public.merchant_profiles;

CREATE TRIGGER trg_process_merchant_referral
  AFTER INSERT ON public.merchant_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.process_merchant_referral();

-- ── Permissions ─────────────────────────────────────────────
GRANT SELECT ON public.app_configs TO authenticated;
GRANT SELECT ON public.merchant_rewards_log TO authenticated;
GRANT ALL ON public.merchant_rewards_log TO postgres;
GRANT ALL ON public.app_configs TO postgres;
