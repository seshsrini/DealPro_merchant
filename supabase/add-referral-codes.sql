-- Migration: Add referral code columns for merchant QR code system
-- Run this in Supabase SQL Editor

-- 1. Add two unique referral code columns to merchant_profiles
ALTER TABLE merchant_profiles
  ADD COLUMN IF NOT EXISTS consumer_referral_code VARCHAR(6) UNIQUE,
  ADD COLUMN IF NOT EXISTS merchant_referral_code VARCHAR(6) UNIQUE;

-- Index for fast lookup when consumer signs up with a referral code
CREATE INDEX IF NOT EXISTS idx_merchant_consumer_referral
  ON merchant_profiles (consumer_referral_code);

CREATE INDEX IF NOT EXISTS idx_merchant_merchant_referral
  ON merchant_profiles (merchant_referral_code);

-- 2. Add referral_code column to user_profiles
--    Stores the merchant's consumer_referral_code when a consumer signs up via QR scan
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(6);

CREATE INDEX IF NOT EXISTS idx_user_referral_code
  ON user_profiles (referral_code);

-- 3. Backfill existing merchants with unique referral codes
--    Uses ambiguity-free charset (no 0/O/1/I)

-- Consumer referral codes
UPDATE merchant_profiles
SET consumer_referral_code = UPPER(
  SUBSTR(
    REPLACE(REPLACE(REPLACE(REPLACE(
      MD5(RANDOM()::TEXT || id::TEXT || 'consumer'),
      '0','X'), 'o','Y'), 'l','Z'), 'i','W'
    ), 1, 6
  )
)
WHERE consumer_referral_code IS NULL;

-- Merchant referral codes
UPDATE merchant_profiles
SET merchant_referral_code = UPPER(
  SUBSTR(
    REPLACE(REPLACE(REPLACE(REPLACE(
      MD5(RANDOM()::TEXT || id::TEXT || 'merchant'),
      '0','X'), 'o','Y'), 'l','Z'), 'i','W'
    ), 1, 6
  )
)
WHERE merchant_referral_code IS NULL;

-- Verify no duplicates (run these SELECT queries after the UPDATE)
-- SELECT consumer_referral_code, COUNT(*) FROM merchant_profiles
--   GROUP BY consumer_referral_code HAVING COUNT(*) > 1;
-- SELECT merchant_referral_code, COUNT(*) FROM merchant_profiles
--   GROUP BY merchant_referral_code HAVING COUNT(*) > 1;
