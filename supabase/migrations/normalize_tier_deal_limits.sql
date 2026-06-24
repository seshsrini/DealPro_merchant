-- ──────────────────────────────────────────────────────────────────────────
-- Stray "5 max deals" investigation + fix.
--
-- The app reads ONLY subscription_tiers.max_campaigns_per_month for the deal
-- limit. A stray "5" therefore comes from the DATA, not the code:
--   (a) a leftover is_active tier row whose max_campaigns_per_month is 5
--       (e.g. the 'basic' ₹999 tier from supabase/seed-subscription-tiers.sql),
--       and/or
--   (b) the legacy features->>'max_deals' value (Premium/Platinum = 5) that
--       disagrees with the authoritative column.
--
-- Run STEP 1 to see what you actually have, then STEP 2/3 to fix.
-- ──────────────────────────────────────────────────────────────────────────

-- STEP 1 — Inspect every tier the app could show (is_active = true).
-- Confirm only your intended tiers are active (e.g. ₹199→3, ₹399→8). Any other
-- active row — especially one with max_campaigns_per_month = 5 — is the culprit.
SELECT
  id, tier_key, tier_name, subscription_fee, billing_frequency,
  max_campaigns_per_month, max_dotd_per_month, is_active,
  (features->>'max_deals')          AS features_max_deals,        -- stale/legacy
  (features->>'max_deals')::int
     IS DISTINCT FROM max_campaigns_per_month AS limits_disagree  -- TRUE = inconsistent
FROM subscription_tiers
ORDER BY is_active DESC, subscription_fee ASC;

-- STEP 2 — Remove the inconsistency in the unused legacy field so the table can
-- never report a different number than the column the app trusts. Safe: only
-- rewrites features.max_deals to equal max_campaigns_per_month.
UPDATE subscription_tiers
SET features = jsonb_set(
      COALESCE(features, '{}'::jsonb),
      '{max_deals}',
      to_jsonb(max_campaigns_per_month),
      true
    )
WHERE (features->>'max_deals') IS DISTINCT FROM max_campaigns_per_month::text;

-- STEP 3 — Deactivate stray/legacy tiers that should NOT be offered. Review the
-- STEP 1 output first, then list the unwanted tier_keys here. Example shape
-- (EDIT the keys to match the strays you actually found — do NOT run blindly):
--
-- UPDATE subscription_tiers
-- SET is_active = false
-- WHERE tier_key IN ('basic', 'pro', 'premium');   -- the ₹999/2499/4999 sample set
--
-- (Leave 'pro_test' alone if you still use the VITE_ALLOW_TEST_SUBSCRIPTION bypass.)
