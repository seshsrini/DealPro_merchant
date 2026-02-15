-- ============================================================================
-- CORRECT DATABASE INDEXES FOR YOUR SCHEMA
-- ============================================================================
-- Your campaigns table uses "latlong" not "city"
-- Run this in Supabase SQL Editor

-- Index for location-based queries (using latlong field)
CREATE INDEX IF NOT EXISTS idx_campaigns_latlong
ON campaigns(latlong);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_campaigns_status
ON campaigns(status)
WHERE status = 'active';

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_campaigns_dates
ON campaigns(start_date, end_date);

-- Index for merchant campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant
ON campaigns(merchant_id);

-- Index for store lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_store
ON campaigns(store_id);

-- Index for deal of the day
CREATE INDEX IF NOT EXISTS idx_campaigns_dotd
ON campaigns(is_deal_of_the_day, start_date)
WHERE is_deal_of_the_day = true;

-- Index for favorites by consumer
CREATE INDEX IF NOT EXISTS idx_favorites_consumer
ON favorites(consumer_id);

-- Index for transaction claims
CREATE INDEX IF NOT EXISTS idx_transaction_claims_consumer
ON transaction_claims(consumer_id, created_at DESC);

-- Index for campaign interactions
CREATE INDEX IF NOT EXISTS idx_campaign_interactions
ON campaign_interactions(campaign_id, created_at DESC);

-- Update table statistics
ANALYZE campaigns;
ANALYZE favorites;
ANALYZE transaction_claims;
ANALYZE user_profiles;

-- Verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('campaigns', 'favorites', 'transaction_claims')
ORDER BY tablename, indexname;
