-- Generate Test Data for DealPro Load Testing
-- Matches your actual database schema with auth.users and public.profiles

-- =============================================================================
-- YOUR DATABASE STRUCTURE:
-- - auth.users (Supabase Auth - cannot create via SQL)
-- - public.profiles (User profile data)
-- - public.user_profiles (Additional user data)
-- - public.campaigns (Deals/campaigns)
-- - public.merchant_stores (Store locations)
-- - public.transaction_claims (Deal claims)
-- - public.favorites (User favorites)
-- =============================================================================

-- =============================================================================
-- STEP 1: CREATE TEST CAMPAIGNS (Works immediately!)
-- =============================================================================

DO $$
DECLARE
  i INTEGER;
  cities TEXT[] := ARRAY['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad'];
  categories TEXT[] := ARRAY['Food & Dining', 'Fashion & Retail', 'Electronics', 'Beauty & Wellness', 'Services', 'Automotive', 'Education', 'Health'];
  offers TEXT[] := ARRAY[
    '50% Off on All Items',
    'Buy 1 Get 1 Free',
    'Flat ₹500 Off',
    '30% Discount',
    'Up to 70% Off',
    'Weekend Special - 40% Off',
    'Limited Time - ₹1000 Cashback',
    'Flash Sale - Extra 20% Off'
  ];
  latlong_map JSONB := '{
    "Bangalore": "12.9716, 77.5946",
    "Mumbai": "19.0760, 72.8777",
    "Delhi": "28.7041, 77.1025",
    "Chennai": "13.0827, 80.2707",
    "Kolkata": "22.5726, 88.3639",
    "Hyderabad": "17.3850, 78.4867",
    "Pune": "18.5204, 73.8567",
    "Ahmedabad": "23.0225, 72.5714"
  }'::JSONB;
  city_name TEXT;
  category_name TEXT;
  offer_text TEXT;
  heading TEXT;
  start_dt DATE;
  coords TEXT;
BEGIN
  RAISE NOTICE 'Creating 500 test campaigns...';

  FOR i IN 1..500 LOOP
    city_name := cities[1 + (i % 8)];
    category_name := categories[1 + (i % 8)];
    offer_text := offers[1 + (i % 8)];
    heading := 'Test Deal ' || i || ' - ' || offer_text;
    start_dt := CURRENT_DATE + ((i % 30) - 5); -- Some in past, some future
    coords := latlong_map->>city_name;

    INSERT INTO public.campaigns (
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
      'test-campaign-' || lpad(i::TEXT, 4, '0'), -- test-campaign-0001, etc.
      'Test Store ' || ((i % 100) + 1),
      heading,
      offer_text,
      category_name,
      city_name,
      start_dt,
      start_dt + INTERVAL '14 days', -- 2 week duration
      '<p><strong>🎉 Amazing Test Deal!</strong></p><ul><li>✅ Limited time offer</li><li>✅ Valid at all locations</li><li>✅ No hidden charges</li></ul><p><em>Terms and conditions apply.</em></p>',
      CASE
        WHEN start_dt > CURRENT_DATE THEN 'pending'
        WHEN start_dt + INTERVAL '14 days' < CURRENT_DATE THEN 'expired'
        ELSE 'active'
      END,
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80',
      coords,
      NOW() - (INTERVAL '1 day' * (500 - i)) -- Stagger creation dates
    )
    ON CONFLICT (campaign_id) DO NOTHING;

    -- Progress indicator
    IF i % 100 = 0 THEN
      RAISE NOTICE '  Created % campaigns...', i;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Successfully created 500 test campaigns!';
END $$;

-- =============================================================================
-- STEP 2: VERIFY TEST CAMPAIGNS
-- =============================================================================

-- Count test campaigns by status
SELECT
  status,
  COUNT(*) as count
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'
GROUP BY status
ORDER BY status;

-- Count test campaigns by city
SELECT
  city,
  COUNT(*) as count
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'
GROUP BY city
ORDER BY count DESC;

-- Show sample test campaigns
SELECT
  campaign_id,
  deal_heading,
  city,
  category,
  status,
  start_date,
  end_date
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'
ORDER BY created_at DESC
LIMIT 10;

-- =============================================================================
-- STEP 3: PREPARE FOR TEST USER PROFILES (Optional)
-- =============================================================================

-- This function prepares profiles for test users once they're created in auth.users
CREATE OR REPLACE FUNCTION create_test_profile(
  user_id UUID,
  username TEXT,
  user_email TEXT,
  user_role TEXT DEFAULT 'consumer'
)
RETURNS void AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO public.profiles (
    id,
    username,
    email,
    role,
    onboarding_complete,
    created_at,
    updated_at
  )
  VALUES (
    user_id,
    username,
    user_email,
    user_role,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = NOW();

  -- Insert into user_profiles if it exists
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    INSERT INTO public.user_profiles (
      id,
      username,
      email,
      created_at
    )
    VALUES (
      user_id,
      username,
      user_email,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Created profile for user: %', username;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 4: INSTRUCTIONS FOR CREATING TEST USERS
-- =============================================================================

/*
📌 CREATING TEST USERS IN SUPABASE:

Since you're using Supabase Auth, test users must be created via:

OPTION A - Supabase Dashboard (Easiest for small numbers):
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Email: testuser0@loadtest.com
4. Password: TestPassword123!
5. Repeat for testuser1, testuser2, etc.
6. Auto-confirm email: YES

OPTION B - Use existing real users:
Just use your existing user accounts for testing!
The load test simulates 2000 concurrent sessions even with just 1 user account.

OPTION C - Supabase Auth API (for bulk creation):
Use the signup endpoint via Postman or a script to create users programmatically.

After creating auth users, their profiles will be auto-created via database triggers
(if you have them set up), or you can manually create profiles using:

SELECT create_test_profile(
  'USER_UUID_HERE',
  'testuser0',
  'testuser0@loadtest.com',
  'consumer'
);
*/

-- =============================================================================
-- STEP 5: POPULATE SOME TEST FAVORITES (Optional)
-- =============================================================================

-- If you have existing users, create some test favorites for realism
CREATE OR REPLACE FUNCTION generate_test_favorites(user_count INTEGER DEFAULT 10)
RETURNS void AS $$
DECLARE
  user_record RECORD;
  campaign_record RECORD;
  i INTEGER;
BEGIN
  -- For each user, favorite 5-10 random test campaigns
  FOR user_record IN
    SELECT id FROM auth.users
    ORDER BY created_at DESC
    LIMIT user_count
  LOOP
    FOR i IN 1..(5 + floor(random() * 5)::INTEGER) LOOP
      -- Pick a random test campaign
      SELECT campaign_id INTO campaign_record
      FROM public.campaigns
      WHERE campaign_id LIKE 'test-campaign-%'
      ORDER BY RANDOM()
      LIMIT 1;

      -- Create favorite
      INSERT INTO public.favorites (
        consumer_id,
        campaign_id,
        created_at
      )
      VALUES (
        user_record.id,
        campaign_record.campaign_id,
        NOW()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Created test favorites for % users', user_count;
END;
$$ LANGUAGE plpgsql;

-- Run this after you have test users created:
-- SELECT generate_test_favorites(10);

-- =============================================================================
-- STEP 6: CLEANUP FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_test_data()
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'Starting cleanup of test data...';

  -- Delete test favorites
  DELETE FROM public.favorites
  WHERE campaign_id LIKE 'test-campaign-%';

  -- Delete test claims
  DELETE FROM public.transaction_claims
  WHERE campaign_id LIKE 'test-campaign-%';

  -- Delete test campaign interactions
  DELETE FROM public.campaign_interactions
  WHERE campaign_id LIKE 'test-campaign-%';

  -- Delete test campaigns
  DELETE FROM public.campaigns
  WHERE campaign_id LIKE 'test-campaign-%';

  -- Delete test user profiles (from auth.users with @loadtest.com emails)
  DELETE FROM public.profiles
  WHERE email LIKE '%@loadtest.com';

  DELETE FROM public.user_profiles
  WHERE email LIKE '%@loadtest.com';

  -- Note: You must manually delete auth.users via Supabase Dashboard
  -- Go to Authentication → Users → Search for @loadtest.com → Delete

  -- Cleanup and optimize
  VACUUM ANALYZE public.campaigns;
  VACUUM ANALYZE public.favorites;
  VACUUM ANALYZE public.transaction_claims;
  VACUUM ANALYZE public.profiles;

  RAISE NOTICE '✅ Cleanup complete! Note: Delete auth.users manually from Dashboard';
END;
$$ LANGUAGE plpgsql;

-- To cleanup test data after testing:
-- SELECT cleanup_test_data();

-- =============================================================================
-- STEP 7: FINAL VERIFICATION
-- =============================================================================

-- Summary of test data
SELECT
  '✅ Test Campaigns' as item,
  COUNT(*)::TEXT as count,
  '(campaign_id LIKE test-campaign-%)' as filter
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'

UNION ALL

SELECT
  'Total Active Campaigns' as item,
  COUNT(*)::TEXT as count,
  '(status = active)' as filter
FROM public.campaigns
WHERE status = 'active'

UNION ALL

SELECT
  'Test Favorites' as item,
  COUNT(*)::TEXT as count,
  '(campaign_id LIKE test-campaign-%)' as filter
FROM public.favorites
WHERE campaign_id LIKE 'test-campaign-%'

UNION ALL

SELECT
  'Test User Profiles' as item,
  COUNT(*)::TEXT as count,
  '(email LIKE %@loadtest.com)' as filter
FROM public.profiles
WHERE email LIKE '%@loadtest.com';

-- =============================================================================
-- 🎯 QUICK START SUMMARY
-- =============================================================================

/*
✅ WHAT WAS CREATED:
- 500 test campaigns across 8 cities
- Campaigns in various categories
- Mix of active, pending, and expired campaigns
- Helper functions for profiles and favorites

🚀 NEXT STEPS:

1. Test campaigns are ready! ✅

2. For test users, you have 3 options:
   A) Create 2-3 test users manually via Supabase Dashboard
   B) Use your existing real users
   C) Skip - the load test works even with 1 user account!

3. Update stress-test.js with real credentials:
   const TEST_USERS = [
     { username: 'youruser', email: 'you@example.com', password: 'yourpass' }
   ];

4. Run the load test:
   cd C:\Srini\dealpro\dev\dealpro\load-testing
   k6 run --vus 10 --duration 1m stress-test.js

💡 TIP: You don't need 1000 test users!
   k6 simulates 2000 concurrent SESSIONS using just a few user accounts.
   Each VU (virtual user) reuses credentials to create concurrent sessions.

🧹 CLEANUP AFTER TESTING:
   SELECT cleanup_test_data();
   Then manually delete @loadtest.com users from Supabase Dashboard
*/
