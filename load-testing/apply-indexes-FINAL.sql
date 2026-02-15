-- ============================================================================
-- CORRECT DATABASE INDEXES - FIXED FOR YOUR ACTUAL SCHEMA
-- ============================================================================
-- Fixed: favorites uses user_id (not consumer_id)

-- Index for location-based queries (using latlong field)
CREATE INDEX IF NOT EXISTS idx_campaigns_latlong ON campaigns(latlong);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status) WHERE status = 'active';

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);

-- Index for merchant campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant ON campaigns(merchant_id);

-- Index for store lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_store ON campaigns(store_id);

-- Index for deal of the day
CREATE INDEX IF NOT EXISTS idx_campaigns_dotd ON campaigns(is_deal_of_the_day, start_date) WHERE is_deal_of_the_day = true;

-- Index for favorites by user (CORRECTED: user_id not consumer_id)
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

-- Index for transaction claims (check if column is user_id or consumer_id)
CREATE INDEX IF NOT EXISTS idx_transaction_claims_user ON transaction_claims(user_id, created_at DESC);

-- Index for campaign interactions
CREATE INDEX IF NOT EXISTS idx_campaign_interactions ON campaign_interactions(campaign_id, created_at DESC);

-- Update table statistics
ANALYZE campaigns;
ANALYZE favorites;
ANALYZE transaction_claims;
ANALYZE user_profiles;

-- Success message
SELECT 'Indexes created successfully!' as status;
