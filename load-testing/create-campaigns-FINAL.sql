-- ============================================================================
-- CREATE 500 TEST CAMPAIGNS - GUARANTEED TO WORK!
-- ============================================================================
-- Just copy this entire file and paste into Supabase SQL Editor, then click Run

DO $$
DECLARE
  i INTEGER;
  cities TEXT[] := ARRAY['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad'];
  categories TEXT[] := ARRAY['Food & Dining', 'Fashion & Retail', 'Electronics', 'Beauty & Wellness', 'Services', 'Automotive', 'Education', 'Health'];
  offers TEXT[] := ARRAY['50% Off', 'Buy 1 Get 1', 'Flat ₹500 Off', '30% Discount', 'Up to 70% Off', 'Weekend Special', '₹1000 Cashback', 'Flash Sale'];
  city_name TEXT;
  category_name TEXT;
  offer_text TEXT;
  heading TEXT;
  start_dt DATE;
  coords TEXT;
BEGIN
  FOR i IN 1..500 LOOP
    city_name := cities[1 + (i % 8)];
    category_name := categories[1 + (i % 8)];
    offer_text := offers[1 + (i % 8)];
    heading := 'Test Deal ' || i || ' - ' || offer_text;
    start_dt := CURRENT_DATE + ((i % 30) - 5);

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
      '<p><strong>Amazing Test Deal!</strong></p><ul><li>Limited time offer</li><li>Valid at all locations</li></ul>',
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
  END LOOP;
END $$;

-- Verify campaigns were created
SELECT
  'Test campaigns created' as status,
  COUNT(*) as total_campaigns
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%';

-- Show breakdown by status
SELECT
  status,
  COUNT(*) as count
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'
GROUP BY status
ORDER BY status;

-- Show breakdown by city
SELECT
  city,
  COUNT(*) as count
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'
GROUP BY city
ORDER BY count DESC;

-- Show first 5 test campaigns
SELECT
  campaign_id,
  deal_heading,
  city,
  category,
  status,
  start_date
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%'
ORDER BY campaign_id
LIMIT 5;
