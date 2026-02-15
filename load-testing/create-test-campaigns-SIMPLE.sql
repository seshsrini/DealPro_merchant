-- SIMPLE Test Campaign Generator for Load Testing
-- Just creates 500 test campaigns - no user creation needed!

-- =============================================================================
-- CREATE 500 TEST CAMPAIGNS
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
    start_dt := CURRENT_DATE + ((i % 30) - 5); -- Mix of past, current, future deals

    -- Get coordinates for city
    coords := CASE city_name
      WHEN 'Bangalore' THEN '12.9716, 77.5946'
      WHEN 'Mumbai' THEN '19.0760, 72.8777'
      WHEN 'Delhi' THEN '28.7041, 77.1025'
      WHEN 'Chennai' THEN '13.0827, 80.2707'
      WHEN 'Kolkata' THEN '22.5726, 88.3639'
      WHEN 'Hyderabad' THEN '17.3850, 78.4867'
      WHEN 'Pune' THEN '18.5204, 73.8567'
      ELSE '23.0225, 72.5714'
    END;

    -- Insert campaign
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
      'test-campaign-' || lpad(i::TEXT, 4, '0'),
      'Test Store ' || ((i % 100) + 1),
      heading,
      offer_text,
      category_name,
      city_name,
      start_dt,
      start_dt + INTERVAL '14 days',
      '<p><strong>🎉 Amazing Test Deal!</strong></p><ul><li>✅ Limited time offer</li><li>✅ Valid at all locations</li><li>✅ No hidden charges</li></ul><p><em>Terms and conditions apply.</em></p>',
      CASE
        WHEN start_dt > CURRENT_DATE THEN 'pending'
        WHEN start_dt + INTERVAL '14 days' < CURRENT_DATE THEN 'expired'
        ELSE 'active'
      END,
      'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80',
      coords,
      NOW() - (INTERVAL '1 day' * (500 - i))
    )
    ON CONFLICT (campaign_id) DO NOTHING;

    -- Progress indicator
    IF i % 100 = 0 THEN
      RAISE NOTICE '  ✓ Created % campaigns...', i;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Successfully created 500 test campaigns!';
END $$;

-- =============================================================================
-- VERIFY CREATION
-- =============================================================================

-- Count test campaigns by status
SELECT
  '📊 Campaigns by Status' as report,
  status,
  COUNT(*) as count
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'
GROUP BY status
ORDER BY status;

-- Count test campaigns by city
SELECT
  '📍 Campaigns by City' as report,
  city,
  COUNT(*) as count
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'
GROUP BY city
ORDER BY count DESC;

-- Show sample campaigns
SELECT
  '📋 Sample Test Campaigns (First 10)' as report,
  campaign_id,
  deal_heading,
  city,
  category,
  status
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'
ORDER BY campaign_id
LIMIT 10;

-- Total summary
SELECT
  '✅ SUMMARY' as info,
  COUNT(*) as total_test_campaigns,
  COUNT(*) FILTER (WHERE status = 'active') as active_campaigns,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_campaigns,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_campaigns
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%';

-- =============================================================================
-- CLEANUP FUNCTION (Run after testing)
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_test_campaigns()
RETURNS void AS $$
BEGIN
  -- Delete test favorites
  DELETE FROM public.favorites
  WHERE campaign_id LIKE 'test-campaign-%';

  -- Delete test claims
  DELETE FROM public.transaction_claims
  WHERE campaign_id LIKE 'test-campaign-%';

  -- Delete test interactions
  DELETE FROM public.campaign_interactions
  WHERE campaign_id LIKE 'test-campaign-%';

  -- Delete test campaigns
  DELETE FROM public.campaigns
  WHERE campaign_id LIKE 'test-campaign-%';

  -- Optimize tables
  VACUUM ANALYZE public.campaigns;
  VACUUM ANALYZE public.favorites;

  RAISE NOTICE '✅ Cleanup complete! All test campaigns removed.';
END;
$$ LANGUAGE plpgsql;

-- To cleanup after testing, run:
-- SELECT cleanup_test_campaigns();

RAISE NOTICE '
==================================================
✅ TEST DATA CREATION COMPLETE!
==================================================

📊 Created: 500 test campaigns
📍 Cities: 8 major cities
📁 Categories: 8 different categories
⏰ Mix of active, pending, and expired deals

🚀 NEXT STEPS:
1. Update stress-test.js with YOUR real user credentials
2. Apply database indexes (see below)
3. Run: k6 run --vus 10 --duration 1m stress-test.js

🧹 CLEANUP AFTER TESTING:
   SELECT cleanup_test_campaigns();

==================================================
';
