-- Per-step signup tracking on merchant_profiles.
-- Run in BOTH DealFynd projects (DEV hyijwfovsvetpyrbqfcd, PROD trrinhrajmsnkjnwtncz). Safe to re-run.
--
-- patch-merchant-profile now saves each signup step into merchant_profiles
-- (name, legal/store name, business document) and records the last step the
-- merchant reached. Terms/privacy, stores and onboarding_complete are still
-- written only by complete-merchant-profile at the final submit.
--
-- Wizard steps: 0 Welcome · 1 Name · 2 Store (legal name) · 4 Address · 5 Stores ·
-- 6 Verification · 7 Review · 8 Terms · 9 Privacy · 10 Plan · 11 Payment · 12 Done

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS onboarding_step    int,
  ADD COLUMN IF NOT EXISTS onboarding_step_at timestamptz;

COMMENT ON COLUMN public.merchant_profiles.onboarding_step IS
  'Last signup wizard step completed (1 Name, 2 Store, 4 Address, 5 Stores, 6 Verification, 7 Review, 8 Terms, 9 Privacy).';

-- Merchants still mid-signup, furthest-along first:
-- SELECT id, phone, full_name, store_name, business_type, onboarding_step, onboarding_step_at
-- FROM merchant_profiles
-- WHERE coalesce(onboarding_complete, false) = false
-- ORDER BY onboarding_step DESC NULLS LAST, onboarding_step_at DESC;
