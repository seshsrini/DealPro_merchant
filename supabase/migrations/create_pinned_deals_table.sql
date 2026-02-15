-- ============================================================================
-- PINNED DEALS TABLE
-- ============================================================================
-- Allows users to pin deals for future reference
-- Similar to bookmarks/saved items

CREATE TABLE IF NOT EXISTS public.pinned_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id TEXT NOT NULL,
  merchant_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate pins (one user can only pin a campaign once)
  UNIQUE(user_id, campaign_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for quick user lookup (get all pinned deals for a user)
CREATE INDEX IF NOT EXISTS idx_pinned_deals_user_id
ON public.pinned_deals(user_id);

-- Index for campaign lookup (check if specific campaign is pinned)
CREATE INDEX IF NOT EXISTS idx_pinned_deals_campaign_id
ON public.pinned_deals(campaign_id);

-- Composite index for user + campaign (check if user pinned specific campaign)
CREATE INDEX IF NOT EXISTS idx_pinned_deals_user_campaign
ON public.pinned_deals(user_id, campaign_id);

-- Index for merchant lookup (get all pins for a merchant's deals)
CREATE INDEX IF NOT EXISTS idx_pinned_deals_merchant_id
ON public.pinned_deals(merchant_id);

-- Index for recent pins (order by created_at)
CREATE INDEX IF NOT EXISTS idx_pinned_deals_created_at
ON public.pinned_deals(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.pinned_deals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own pinned deals
CREATE POLICY "Users can view their own pinned deals"
ON public.pinned_deals
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can pin deals (insert)
CREATE POLICY "Users can pin deals"
ON public.pinned_deals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can unpin deals (delete their own pins)
CREATE POLICY "Users can unpin deals"
ON public.pinned_deals
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get pinned deal count for a user
CREATE OR REPLACE FUNCTION public.get_pinned_deals_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.pinned_deals
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has pinned a specific campaign
CREATE OR REPLACE FUNCTION public.is_campaign_pinned(p_user_id UUID, p_campaign_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.pinned_deals
    WHERE user_id = p_user_id
      AND campaign_id = p_campaign_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify table was created
SELECT
  'pinned_deals table created successfully' as status,
  COUNT(*) as pin_count
FROM public.pinned_deals;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all pinned deals for a user (with campaign details)
-- SELECT
--   pd.id,
--   pd.campaign_id,
--   pd.merchant_id,
--   pd.created_at,
--   c.deal_heading,
--   c.offer_value,
--   c.shop_name,
--   c.city,
--   c.image_url
-- FROM pinned_deals pd
-- INNER JOIN campaigns c ON pd.campaign_id = c.campaign_id
-- WHERE pd.user_id = 'USER_ID'
-- ORDER BY pd.created_at DESC;

-- Get pinned deals count for a user
-- SELECT get_pinned_deals_count('USER_ID');

-- Check if user pinned a specific campaign
-- SELECT is_campaign_pinned('USER_ID', 'CAMPAIGN_ID');
