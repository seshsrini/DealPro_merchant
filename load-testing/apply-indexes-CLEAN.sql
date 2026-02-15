-- ============================================================================
-- FINAL CLEAN INDEXES - Excluding transaction_claims
-- ============================================================================
-- Copy and paste this entire script into Supabase SQL Editor

-- Campaigns table indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_latlong ON campaigns(latlong);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant ON campaigns(merchant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_store ON campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_dotd ON campaigns(is_deal_of_the_day, start_date) WHERE is_deal_of_the_day = true;

-- Favorites table index
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);

-- Campaign interactions index
CREATE INDEX IF NOT EXISTS idx_campaign_interactions ON campaign_interactions(campaign_id, created_at DESC);

-- Update statistics
ANALYZE campaigns;
ANALYZE favorites;
ANALYZE campaign_interactions;
ANALYZE user_profiles;

-- Success confirmation
SELECT 'All indexes created successfully!' as status, NOW() as timestamp;
