-- Add the registered LEGAL NAME of the business to merchant_profiles.
-- Captured in onboarding step 2 (relabelled from "Store name" to
-- "Legal name of business") and cross-checked against the GST registry's
-- legal name (lgnm) during GSTIN verification. The customer-facing store /
-- brand name lives per-store on merchant_stores.store_name.
ALTER TABLE merchant_profiles
  ADD COLUMN IF NOT EXISTS legal_name TEXT;
