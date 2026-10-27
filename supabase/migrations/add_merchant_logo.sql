-- Merchant business logo (shown to consumers next to the store name).
-- Run in BOTH DealFynd projects (DEV hyijwfovsvetpyrbqfcd, PROD trrinhrajmsnkjnwtncz)
-- before deploying set-merchant-logo / get-all / get-one / get-deals-of-day.
-- Safe to re-run. Written only by the set-merchant-logo function (after an image
-- content check); consumers read it through the deal functions.

ALTER TABLE public.merchant_profiles
  ADD COLUMN IF NOT EXISTS logo_url        text,
  ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz;

COMMENT ON COLUMN public.merchant_profiles.logo_url IS
  'Cloudinary URL of the merchant logo (dealpro-logos/merchant_<id>), set by set-merchant-logo after a content check.';

-- Check:
-- SELECT id, store_name, logo_url, logo_updated_at FROM public.merchant_profiles
-- WHERE logo_url IS NOT NULL ORDER BY logo_updated_at DESC;
