-- Generate Test Data for Load Testing
-- Run this in Supabase SQL Editor to create test users and campaigns

-- =============================================================================
-- 1. CREATE TEST USERS (1000 consumers + 100 merchants)
-- =============================================================================

-- Create a function to generate test users
CREATE OR REPLACE FUNCTION generate_test_users()
RETURNS void AS $$
DECLARE
  i INTEGER;
  username TEXT;
  email TEXT;
  phone TEXT;
BEGIN
  -- Generate 1000 consumer test users
  FOR i IN 0..999 LOOP
    username := 'testuser' || i;
    email := 'testuser' || i || '@loadtest.com';
    phone := '+91' || lpad((9000000000 + i)::TEXT, 10, '0');

    -- Insert only if user doesn't exist
    INSERT INTO users (username, email, phone_number, role, password_hash, onboarding_complete)
    VALUES (username, email, phone, 'consumer', crypt('TestPassword123!', gen_salt('bf')), true)
    ON CONFLICT (username) DO NOTHING;
  END LOOP;

  -- Generate 100 merchant test users
  FOR i IN 0..99 LOOP
    username := 'testmerchant' || i;
    email := 'testmerchant' || i || '@loadtest.com';
    phone := '+91' || lpad((9100000000 + i)::TEXT, 10, '0');

    INSERT INTO users (username, email, phone_number, role, password_hash, store_name, category, onboarding_complete)
    VALUES (
      username,
      email,
      phone,
      'merchant',
      crypt('TestPassword123!', gen_salt('bf')),
      'Test Store ' || i,
      CASE (i % 5)
        WHEN 0 THEN 'Food & Dining'
        WHEN 1 THEN 'Fashion & Retail'
        WHEN 2 THEN 'Electronics'
        WHEN 3 THEN 'Beauty & Wellness'
        ELSE 'Services'
      END,
      true
    )
    ON CONFLICT (username) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Test users created successfully!';
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT generate_test_users();

-- Verify test users were created
SELECT role, COUNT(*) as count
FROM users
WHERE email LIKE '%@loadtest.com'
GROUP BY role;

-- =============================================================================
-- 2. CREATE TEST CAMPAIGNS (500 active campaigns)
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_test_campaigns()
RETURNS void AS $$
DECLARE
  i INTEGER;
  merchant_id UUID;
  city_name TEXT;
  category_name TEXT;
  campaign_heading TEXT;
  offer_text TEXT;
  start_dt DATE;
BEGIN
  -- Cities array
  DECLARE
    cities TEXT[] := ARRAY['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad'];
    categories TEXT[] := ARRAY['Food & Dining', 'Fashion & Retail', 'Electronics', 'Beauty & Wellness', 'Services'];
    offers TEXT[] := ARRAY[
      '50% Off on All Items',
      'Buy 1 Get 1 Free',
      'Flat ₹500 Off',
      '30% Discount',
      'Up to 70% Off',
      'Special Weekend Deal',
      'Limited Time Offer',
      'Flash Sale - 40% Off'
    ];
  BEGIN
    FOR i IN 1..500 LOOP
      -- Get a random merchant
      SELECT id INTO merchant_id
      FROM users
      WHERE role = 'merchant' AND email LIKE '%@loadtest.com'
      ORDER BY RANDOM()
      LIMIT 1;

      -- Random city and category
      city_name := cities[1 + (i % 8)];
      category_name := categories[1 + (i % 5)];
      offer_text := offers[1 + (i % 8)];
      campaign_heading := 'Test Deal ' || i || ' - ' || offer_text;

      -- Random start date (today or within next 30 days)
      start_dt := CURRENT_DATE + (i % 30);

      INSERT INTO campaigns (
        campaign_id,
        merchant_id,
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
        merchant_id,
        'Test Store ' || (i % 100),
        campaign_heading,
        offer_text,
        category_name,
        city_name,
        start_dt,
        start_dt + INTERVAL '7 days',
        '<p>This is a test campaign for load testing.</p><ul><li>Limited time offer</li><li>Terms and conditions apply</li></ul>',
        'active',
        'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80',
        CASE city_name
          WHEN 'Bangalore' THEN '12.9716, 77.5946'
          WHEN 'Mumbai' THEN '19.0760, 72.8777'
          WHEN 'Delhi' THEN '28.7041, 77.1025'
          WHEN 'Chennai' THEN '13.0827, 80.2707'
          WHEN 'Kolkata' THEN '22.5726, 88.3639'
          WHEN 'Hyderabad' THEN '17.3850, 78.4867'
          WHEN 'Pune' THEN '18.5204, 73.8567'
          ELSE '23.0225, 72.5714' -- Ahmedabad
        END,
        NOW()
      )
      ON CONFLICT (campaign_id) DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Test campaigns created successfully!';
  END;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT generate_test_campaigns();

-- Verify test campaigns were created
SELECT
  city,
  category,
  COUNT(*) as campaign_count
FROM campaigns
WHERE campaign_id LIKE 'test-campaign-%'
GROUP BY city, category
ORDER BY city, category;

-- =============================================================================
-- 3. CREATE SOME TEST FAVORITES (to make load test realistic)
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_test_favorites()
RETURNS void AS $$
DECLARE
  i INTEGER;
  consumer_id UUID;
  campaign_id TEXT;
BEGIN
  -- Create 1000 random favorites
  FOR i IN 1..1000 LOOP
    -- Get random consumer
    SELECT id INTO consumer_id
    FROM users
    WHERE role = 'consumer' AND email LIKE '%@loadtest.com'
    ORDER BY RANDOM()
    LIMIT 1;

    -- Get random campaign
    SELECT campaigns.campaign_id INTO campaign_id
    FROM campaigns
    WHERE campaigns.campaign_id LIKE 'test-campaign-%'
    ORDER BY RANDOM()
    LIMIT 1;

    -- Insert favorite (ignore if already exists)
    INSERT INTO favorites (consumer_id, campaign_id, created_at)
    VALUES (consumer_id, campaign_id, NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Test favorites created successfully!';
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT generate_test_favorites();

-- =============================================================================
-- 4. VERIFY TEST DATA
-- =============================================================================

-- Summary of test data created
SELECT
  'Test Users (Consumers)' as item,
  COUNT(*) as count
FROM users
WHERE role = 'consumer' AND email LIKE '%@loadtest.com'
UNION ALL
SELECT
  'Test Users (Merchants)' as item,
  COUNT(*) as count
FROM users
WHERE role = 'merchant' AND email LIKE '%@loadtest.com'
UNION ALL
SELECT
  'Test Campaigns' as item,
  COUNT(*) as count
FROM campaigns
WHERE campaign_id LIKE 'test-campaign-%'
UNION ALL
SELECT
  'Test Favorites' as item,
  COUNT(*) as count
FROM favorites
WHERE consumer_id IN (
  SELECT id FROM users WHERE email LIKE '%@loadtest.com'
);

-- =============================================================================
-- 5. SAMPLE TEST CREDENTIALS
-- =============================================================================

-- Sample test users you can use for manual testing
SELECT
  'Sample Test Credentials' as info,
  username,
  email,
  'TestPassword123!' as password,
  role
FROM users
WHERE email LIKE '%@loadtest.com'
LIMIT 10;

-- =============================================================================
-- 6. CLEANUP FUNCTION (Run after load test to remove test data)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_test_data()
RETURNS void AS $$
BEGIN
  -- Delete test favorites
  DELETE FROM favorites
  WHERE consumer_id IN (
    SELECT id FROM users WHERE email LIKE '%@loadtest.com'
  );

  -- Delete test claims
  DELETE FROM claims
  WHERE consumer_id IN (
    SELECT id FROM users WHERE email LIKE '%@loadtest.com'
  );

  -- Delete test campaigns
  DELETE FROM campaigns
  WHERE campaign_id LIKE 'test-campaign-%';

  -- Delete test merchant stores (if any)
  DELETE FROM merchant_stores
  WHERE merchant_id IN (
    SELECT id FROM users WHERE email LIKE '%@loadtest.com'
  );

  -- Delete test users
  DELETE FROM users
  WHERE email LIKE '%@loadtest.com';

  -- Vacuum to reclaim space
  VACUUM ANALYZE users;
  VACUUM ANALYZE campaigns;
  VACUUM ANALYZE favorites;
  VACUUM ANALYZE claims;

  RAISE NOTICE 'Test data cleaned up successfully!';
END;
$$ LANGUAGE plpgsql;

-- To cleanup test data after load test, run:
-- SELECT cleanup_test_data();

-- =============================================================================
-- NOTES:
-- =============================================================================
-- 1. All test users have password: TestPassword123!
-- 2. Test user emails end with @loadtest.com
-- 3. Test campaigns have campaign_id starting with 'test-campaign-'
-- 4. To cleanup, run: SELECT cleanup_test_data();
-- 5. Test data is isolated and won't affect real users/campaigns
