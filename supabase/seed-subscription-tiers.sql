-- ⚠️ SAMPLE / THROWAWAY DATA — DO NOT RUN AGAINST A LIVE PROJECT.
-- These are placeholder tiers (basic ₹999 / pro ₹2499 / premium ₹4999) that do
-- NOT match the real DealPro plan set (see scripts/seed-data.sql:
-- basic_monthly ₹199→3 deals, etc.). Running this inserts a stray 'basic' tier
-- with max_campaigns_per_month = 5 that shows up as a "5 max deals" plan card.
-- If you've already run it, use supabase/migrations/normalize_tier_deal_limits.sql
-- to find and deactivate the strays.
--
-- Insert sample subscription tiers for DealPro merchants
-- Run this in your Supabase SQL Editor

INSERT INTO subscription_tiers (
  tier_key,
  tier_name,
  description,
  currency,
  subscription_fee,
  billing_frequency,
  trial_period_days,
  is_active,
  max_campaigns_per_month,
  max_dotd_per_month,
  is_multi_store,
  features
) VALUES
-- Basic Tier
(
  'basic',
  'Basic',
  'Perfect for small businesses getting started with deal promotions',
  'INR',
  999.00,
  'monthly',
  7,
  true,
  5,
  1,
  false,
  '{"analytics": true, "customer_support": false, "priority_listing": false, "advanced_analytics": false}'::jsonb
),

-- Pro Tier
(
  'pro',
  'Professional',
  'Ideal for growing businesses with multiple deals and better visibility',
  'INR',
  2499.00,
  'monthly',
  7,
  true,
  15,
  3,
  true,
  '{"analytics": true, "customer_support": true, "priority_listing": true, "advanced_analytics": false}'::jsonb
),

-- Premium Tier
(
  'premium',
  'Premium',
  'Complete solution for established businesses seeking maximum exposure',
  'INR',
  4999.00,
  'monthly',
  14,
  true,
  50,
  10,
  true,
  '{"analytics": true, "customer_support": true, "priority_listing": true, "advanced_analytics": true, "dedicated_account_manager": true}'::jsonb
);

-- Verify the insert
SELECT
  tier_name,
  subscription_fee,
  max_campaigns_per_month,
  max_dotd_per_month,
  is_active
FROM subscription_tiers
ORDER BY subscription_fee ASC;
