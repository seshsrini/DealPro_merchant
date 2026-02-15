-- Generate Test Data for Load Testing (Supabase Auth Version)
-- This version works with Supabase's built-in auth system

-- =============================================================================
-- IMPORTANT: This script uses Supabase Auth (auth.users)
-- If you have a custom users table, use generate-test-data-custom.sql instead
-- =============================================================================

-- =============================================================================
-- 1. CREATE TEST USERS IN SUPABASE AUTH
-- =============================================================================

-- Note: In Supabase, you typically create users via the auth.users table
-- and then profiles in a public.profiles table

-- First, let's create a profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT,
  phone_number TEXT,
  role TEXT DEFAULT 'consumer',
  store_name TEXT,
  category TEXT,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow users to read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Create RLS policy to allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============================================================================
-- 2. FUNCTION TO CREATE TEST USERS
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_test_users_auth()
RETURNS TABLE(username TEXT, email TEXT, password TEXT, role TEXT) AS $$
DECLARE
  test_user_id UUID;
  i INTEGER;
  test_username TEXT;
  test_email TEXT;
  test_phone TEXT;
  test_role TEXT;
BEGIN
  -- We'll return the credentials for manual creation
  -- Supabase auth users must be created via the Auth API, not directly in SQL

  -- Generate consumer test users
  FOR i IN 0..999 LOOP
    test_username := 'testuser' || i;
    test_email := 'testuser' || i || '@loadtest.com';
    test_role := 'consumer';

    RETURN QUERY SELECT test_username, test_email, 'TestPassword123!'::TEXT, test_role;
  END LOOP;

  -- Generate merchant test users
  FOR i IN 0..99 LOOP
    test_username := 'testmerchant' || i;
    test_email := 'testmerchant' || i || '@loadtest.com';
    test_role := 'merchant';

    RETURN QUERY SELECT test_username, test_email, 'TestPassword123!'::TEXT, test_role;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. ALTERNATIVE: CREATE SIMPLE TEST USERS DIRECTLY (If you have custom setup)
-- =============================================================================

-- If your app doesn't use Supabase Auth or you have a custom users table:
-- First check if you have a users table in public schema

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'users'
  ) THEN
    -- Create test users in public.users table
    FOR i IN 0..99 LOOP
      INSERT INTO public.users (
        username,
        email,
        phone_number,
        role,
        onboarding_complete
      )
      VALUES (
        'testuser' || i,
        'testuser' || i || '@loadtest.com',
        '+91' || lpad((9000000000 + i)::TEXT, 10, '0'),
        'consumer',
        true
      )
      ON CONFLICT (email) DO NOTHING
      ON CONFLICT (username) DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Created test users in public.users table';
  ELSE
    RAISE NOTICE 'No public.users table found. Using Supabase Auth instead.';
  END IF;
END $$;

-- =============================================================================
-- 4. CREATE TEST CAMPAIGNS (Works regardless of auth setup)
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_test_campaigns_simple()
RETURNS void AS $$
DECLARE
  i INTEGER;
  city_name TEXT;
  category_name TEXT;
  campaign_heading TEXT;
  offer_text TEXT;
  start_dt DATE;
  cities TEXT[] := ARRAY['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Kolkata'];
  categories TEXT[] := ARRAY['Food & Dining', 'Fashion & Retail', 'Electronics', 'Beauty & Wellness', 'Services'];
  offers TEXT[] := ARRAY['50% Off', 'Buy 1 Get 1', 'Flat ₹500 Off', '30% Discount', 'Up to 70% Off'];
BEGIN
  FOR i IN 1..500 LOOP
    city_name := cities[1 + (i % 5)];
    category_name := categories[1 + (i % 5)];
    offer_text := offers[1 + (i % 5)];
    campaign_heading := 'Test Deal ' || i || ' - ' || offer_text;
    start_dt := CURRENT_DATE + (i % 30);

    INSERT INTO campaigns (
      campaign_id,
      shop_name,
      deal_heading,
      offer_value,
      category,
      city,
      start_date,
      end_date,
      long_description,
      status,
      image_url,
      latlong,
      created_at
    )
    VALUES (
      'test-campaign-' || i,
      'Test Store ' || (i % 100),
      campaign_heading,
      offer_text,
      category_name,
      city_name,
      start_dt,
      start_dt + INTERVAL '7 days',
      '<p>Test campaign for load testing</p>',
      'active',
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80',
      CASE city_name
        WHEN 'Bangalore' THEN '12.9716, 77.5946'
        WHEN 'Mumbai' THEN '19.0760, 72.8777'
        WHEN 'Delhi' THEN '28.7041, 77.1025'
        WHEN 'Chennai' THEN '13.0827, 80.2707'
        ELSE '22.5726, 88.3639'
      END,
      NOW()
    )
    ON CONFLICT (campaign_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Created 500 test campaigns';
END;
$$ LANGUAGE plpgsql;

-- Execute campaign generation
SELECT generate_test_campaigns_simple();

-- =============================================================================
-- 5. VERIFY TEST DATA
-- =============================================================================

-- Count test campaigns
SELECT COUNT(*) as test_campaigns
FROM campaigns
WHERE campaign_id LIKE 'test-campaign-%';

-- Show sample campaigns
SELECT campaign_id, deal_heading, city, category, status
FROM campaigns
WHERE campaign_id LIKE 'test-campaign-%'
LIMIT 10;

-- =============================================================================
-- 6. CLEANUP FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_test_data_simple()
RETURNS void AS $$
BEGIN
  -- Delete test campaigns
  DELETE FROM campaigns WHERE campaign_id LIKE 'test-campaign-%';

  -- Delete test users from public.users if exists
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    DELETE FROM users WHERE email LIKE '%@loadtest.com';
  END IF;

  -- Delete test profiles if exists
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    DELETE FROM profiles WHERE email LIKE '%@loadtest.com';
  END IF;

  VACUUM ANALYZE;

  RAISE NOTICE 'Test data cleaned up';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- USAGE INSTRUCTIONS
-- =============================================================================

/*
1. Run this entire script in Supabase SQL Editor

2. For test campaigns: Already created ✅

3. For test users:
   - If you use Supabase Auth: You'll need to create users via the Supabase Dashboard
     or Auth API (they can't be created via SQL)
   - If you have a custom users table: They should be created automatically

4. To cleanup after testing:
   SELECT cleanup_test_data_simple();

5. Test user credentials:
   Email: testuser0@loadtest.com to testuser999@loadtest.com
   Password: TestPassword123!
*/
