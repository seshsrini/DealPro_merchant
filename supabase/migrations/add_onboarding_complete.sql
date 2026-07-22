-- Authoritative "profile fully completed" flag on merchant_profiles.
-- Set true ONLY by the final onboarding submit (complete-merchant-profile), once
-- name + store + business verification + Terms + Privacy are all captured. The app
-- gate reads this (plus an active subscription) to decide dashboard access; when
-- false, the wizard resumes at whichever step is still missing.

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;

-- Backfill EXISTING complete merchants so the new gate never bounces a current
-- merchant back into signup. A profile counts as complete when every core wizard
-- field is present AND both legal consents are recorded.
UPDATE public.merchant_profiles
SET onboarding_complete = true
WHERE onboarding_complete = false
  AND full_name       IS NOT NULL AND full_name       <> ''
  AND store_name      IS NOT NULL AND store_name      <> ''
  AND business_type   IS NOT NULL AND business_type   <> ''
  AND terms_accepted   = true
  AND privacy_accepted = true;
