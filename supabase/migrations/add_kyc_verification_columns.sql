-- Merchant KYC verification: per-document "verified" flag + the raw provider JSON
-- response, set when the merchant taps "Verify" in onboarding. Run in DEV + PROD.
alter table public.merchant_profiles
  add column if not exists gstin_verified boolean not null default false,
  add column if not exists gstin_verification jsonb,
  add column if not exists udyam_verified boolean not null default false,
  add column if not exists udyam_verification jsonb,
  add column if not exists fssai_verified boolean not null default false,
  add column if not exists fssai_verification jsonb,
  add column if not exists trade_license_verified boolean not null default false,
  add column if not exists trade_license_verification jsonb;
