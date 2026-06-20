-- ═══════════════════════════════════════════════════════════════
-- Referral reward → REFUND model (5 referrals = 1 free month, carryover)
-- ═══════════════════════════════════════════════════════════════
-- Under Razorpay native subscriptions we can't skip a billing cycle, so the
-- free month is given by REFUNDING that cycle's charge (handled in the
-- razorpay-webhook on subscription.charged). Granting therefore happens at
-- BILLING time, not at referral signup.
--
-- This migration:
--   1. Sets the threshold to 5 (was 20).
--   2. Simplifies the signup trigger to only RECORD referrals — it no longer
--      auto-extends the subscription period (grant_free_month), which did
--      nothing for Razorpay subs and would conflict with the refund ledger.
--
-- Credits are computed at billing time as:
--   floor(count(qualified referrals) / 5)  −  count(free months already granted)
-- so unused referrals carry over automatically.

UPDATE public.app_configs
   SET config_value = '{ "count": 5 }', updated_at = now()
 WHERE config_key = 'referral_reward_threshold';

-- Trigger now ONLY records the referral; no auto-grant / period extension.
CREATE OR REPLACE FUNCTION public.process_merchant_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  referrer_merchant_id VARCHAR(255);
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
    RETURN NEW;
  END IF;

  INSERT INTO public.merchant_referrals (referrer_id, referee_id, referral_code_used, status, qualified_at)
  VALUES (referrer_merchant_id, NEW.id, NEW.invite_code, 'qualified', now())
  ON CONFLICT (referee_id) DO NOTHING;

  RETURN NEW;
END;
$$;
