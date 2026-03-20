-- ═══════════════════════════════════════════════════════════════
-- Backfill missing referral codes for existing merchants
-- Run this once in the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Function to generate a unique 6-char code
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(col_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  exists_count INT;
BEGIN
  FOR attempt IN 1..10 LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;

    -- Check uniqueness
    IF col_name = 'consumer_referral_code' THEN
      SELECT COUNT(*) INTO exists_count FROM merchant_profiles WHERE consumer_referral_code = code;
    ELSE
      SELECT COUNT(*) INTO exists_count FROM merchant_profiles WHERE merchant_referral_code = code;
    END IF;

    IF exists_count = 0 THEN
      RETURN code;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'Failed to generate unique code after 10 attempts';
END;
$$;

-- Backfill consumer_referral_code where missing
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM merchant_profiles WHERE consumer_referral_code IS NULL LOOP
    UPDATE merchant_profiles
    SET consumer_referral_code = public.generate_unique_referral_code('consumer_referral_code')
    WHERE id = r.id;
  END LOOP;
END $$;

-- Backfill merchant_referral_code where missing
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM merchant_profiles WHERE merchant_referral_code IS NULL LOOP
    UPDATE merchant_profiles
    SET merchant_referral_code = public.generate_unique_referral_code('merchant_referral_code')
    WHERE id = r.id;
  END LOOP;
END $$;

-- Verify: count remaining nulls (should be 0)
SELECT
  COUNT(*) FILTER (WHERE consumer_referral_code IS NULL) AS missing_consumer_codes,
  COUNT(*) FILTER (WHERE merchant_referral_code IS NULL) AS missing_merchant_codes,
  COUNT(*) AS total_merchants
FROM merchant_profiles;

-- Clean up helper function (optional — keep if you want to reuse)
-- DROP FUNCTION IF EXISTS public.generate_unique_referral_code(TEXT);
