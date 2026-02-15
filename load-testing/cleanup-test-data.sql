-- ============================================================================
-- CLEANUP TEST DATA - Run this after load testing is complete
-- ============================================================================

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
VACUUM ANALYZE public.transaction_claims;

-- Verify cleanup
SELECT
  'Cleanup complete' as status,
  COUNT(*) as remaining_test_campaigns
FROM public.campaigns
WHERE campaign_id LIKE 'test-campaign-%';
