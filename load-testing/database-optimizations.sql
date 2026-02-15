-- DealPro Database Performance Optimizations
-- Apply these optimizations before running load tests

-- =============================================================================
-- 1. ESSENTIAL INDEXES
-- =============================================================================

-- Campaigns table - Most critical for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_city_status
ON campaigns(city, status)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_campaigns_start_end_date
ON campaigns(start_date, end_date)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_campaigns_category
ON campaigns(category)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_campaigns_merchant
ON campaigns(merchant_id);

CREATE INDEX IF NOT EXISTS idx_campaigns_deal_of_day
ON campaigns(is_deal_of_the_day, start_date)
WHERE is_deal_of_the_day = true AND status = 'active';

-- Composite index for location + date queries
CREATE INDEX IF NOT EXISTS idx_campaigns_location_date
ON campaigns(city, start_date, status);

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_username
ON users(username)
WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_phone
ON users(phone_number);

-- Claims/Redemptions table
CREATE INDEX IF NOT EXISTS idx_claims_consumer
ON claims(consumer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claims_campaign
ON claims(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claims_status
ON claims(status, created_at DESC);

-- Favorites table
CREATE INDEX IF NOT EXISTS idx_favorites_consumer
ON favorites(consumer_id);

CREATE INDEX IF NOT EXISTS idx_favorites_campaign
ON favorites(campaign_id);

-- Merchant stores table
CREATE INDEX IF NOT EXISTS idx_stores_merchant
ON merchant_stores(merchant_id);

CREATE INDEX IF NOT EXISTS idx_stores_city
ON merchant_stores(city);

-- =============================================================================
-- 2. PARTIAL INDEXES (More efficient for common queries)
-- =============================================================================

-- Only index active campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_active_only
ON campaigns(created_at DESC)
WHERE status = 'active';

-- Only index today's and future deals
CREATE INDEX IF NOT EXISTS idx_campaigns_current_future
ON campaigns(start_date, city)
WHERE start_date >= CURRENT_DATE AND status = 'active';

-- Only index unclaimed deals
CREATE INDEX IF NOT EXISTS idx_claims_unclaimed
ON claims(campaign_id, consumer_id)
WHERE status = 'claimed';

-- =============================================================================
-- 3. FULL-TEXT SEARCH INDEXES
-- =============================================================================

-- Add tsvector column for full-text search on campaigns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create trigger to automatically update search vector
CREATE OR REPLACE FUNCTION campaigns_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.deal_heading, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.shop_name, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.long_description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaigns_search_vector_trigger ON campaigns;
CREATE TRIGGER campaigns_search_vector_trigger
BEFORE INSERT OR UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION campaigns_search_vector_update();

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_campaigns_search
ON campaigns USING GIN(search_vector);

-- Update existing records
UPDATE campaigns SET search_vector =
  setweight(to_tsvector('english', COALESCE(deal_heading, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(shop_name, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(long_description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'D');

-- =============================================================================
-- 4. GEOSPATIAL INDEXES (PostGIS or earthdistance)
-- =============================================================================

-- If using PostGIS
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column for location
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Update location from latlong string
-- UPDATE campaigns
-- SET location = ST_SetSRID(
--   ST_MakePoint(
--     CAST(SPLIT_PART(latlong, ',', 2) AS FLOAT),
--     CAST(SPLIT_PART(latlong, ',', 1) AS FLOAT)
--   ),
--   4326
-- )::geography
-- WHERE latlong IS NOT NULL;

-- Create spatial index
-- CREATE INDEX IF NOT EXISTS idx_campaigns_location_gist
-- ON campaigns USING GIST(location);

-- =============================================================================
-- 5. MATERIALIZED VIEWS (For expensive aggregations)
-- =============================================================================

-- View for popular campaigns (updated periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_popular_campaigns AS
SELECT
  c.campaign_id,
  c.deal_heading,
  c.shop_name,
  c.city,
  c.category,
  c.image_url,
  c.start_date,
  c.end_date,
  COUNT(DISTINCT cl.claim_id) as claim_count,
  COUNT(DISTINCT f.id) as favorite_count,
  (COUNT(DISTINCT cl.claim_id) * 2 + COUNT(DISTINCT f.id)) as popularity_score
FROM campaigns c
LEFT JOIN claims cl ON c.campaign_id = cl.campaign_id
LEFT JOIN favorites f ON c.campaign_id = f.campaign_id
WHERE c.status = 'active'
GROUP BY c.campaign_id, c.deal_heading, c.shop_name, c.city, c.category, c.image_url, c.start_date, c.end_date
ORDER BY popularity_score DESC;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_popular_campaigns_id
ON mv_popular_campaigns(campaign_id);

CREATE INDEX IF NOT EXISTS idx_mv_popular_campaigns_city
ON mv_popular_campaigns(city, popularity_score DESC);

-- Refresh materialized view (run periodically, e.g., every hour)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_popular_campaigns;

-- =============================================================================
-- 6. DATABASE CONFIGURATION TUNING
-- =============================================================================

-- Increase shared buffers (25% of RAM for dedicated server)
-- ALTER SYSTEM SET shared_buffers = '4GB';

-- Increase work memory for complex queries
-- ALTER SYSTEM SET work_mem = '64MB';

-- Increase maintenance work memory for VACUUM, CREATE INDEX
-- ALTER SYSTEM SET maintenance_work_mem = '1GB';

-- Increase effective cache size
-- ALTER SYSTEM SET effective_cache_size = '12GB';

-- Connection pooling
-- ALTER SYSTEM SET max_connections = 200;

-- Write-ahead log settings
-- ALTER SYSTEM SET wal_buffers = '16MB';
-- ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- Query planner settings
-- ALTER SYSTEM SET random_page_cost = 1.1;  -- For SSD
-- ALTER SYSTEM SET effective_io_concurrency = 200;  -- For SSD

-- Apply changes (requires restart)
-- SELECT pg_reload_conf();

-- =============================================================================
-- 7. TABLE PARTITIONING (For very large tables)
-- =============================================================================

-- Example: Partition campaigns by month
-- CREATE TABLE campaigns_partitioned (
--   LIKE campaigns INCLUDING ALL
-- ) PARTITION BY RANGE (start_date);

-- Create monthly partitions
-- CREATE TABLE campaigns_2024_01 PARTITION OF campaigns_partitioned
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- CREATE TABLE campaigns_2024_02 PARTITION OF campaigns_partitioned
--   FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- =============================================================================
-- 8. VACUUM AND ANALYZE
-- =============================================================================

-- Aggressive vacuum to reclaim space
VACUUM (VERBOSE, ANALYZE, FULL) campaigns;
VACUUM (VERBOSE, ANALYZE, FULL) claims;
VACUUM (VERBOSE, ANALYZE, FULL) favorites;
VACUUM (VERBOSE, ANALYZE, FULL) users;

-- Update statistics
ANALYZE campaigns;
ANALYZE claims;
ANALYZE favorites;
ANALYZE users;

-- =============================================================================
-- 9. PERFORMANCE MONITORING SETUP
-- =============================================================================

-- Enable pg_stat_statements extension for query tracking
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Reset statistics
SELECT pg_stat_statements_reset();

-- =============================================================================
-- 10. ROW-LEVEL SECURITY OPTIMIZATION
-- =============================================================================

-- If using RLS, ensure policies are efficient
-- Create indexes on columns used in RLS policies

-- Example: If RLS checks merchant_id
CREATE INDEX IF NOT EXISTS idx_campaigns_rls_merchant
ON campaigns(merchant_id)
WHERE merchant_id IS NOT NULL;

-- =============================================================================
-- 11. CLEANUP OLD DATA (Before load test)
-- =============================================================================

-- Archive old campaigns (older than 6 months)
-- CREATE TABLE campaigns_archive AS
-- SELECT * FROM campaigns
-- WHERE end_date < CURRENT_DATE - INTERVAL '6 months';

-- DELETE FROM campaigns
-- WHERE end_date < CURRENT_DATE - INTERVAL '6 months';

-- Clean up old claims (older than 1 year)
-- DELETE FROM claims
-- WHERE created_at < CURRENT_DATE - INTERVAL '1 year';

-- =============================================================================
-- 12. CONNECTION POOLING (Application level)
-- =============================================================================

-- In your Supabase client, enable connection pooling:
-- URL should use port 6543 instead of 5432
-- Example: postgresql://user:pass@host:6543/database?pgbouncer=true

-- =============================================================================
-- 13. VERIFY OPTIMIZATIONS
-- =============================================================================

-- Check all indexes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check table sizes
SELECT
  schemaname || '.' || tablename as table,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =============================================================================
-- RECOMMENDED ORDER OF EXECUTION
-- =============================================================================
-- 1. Run section 1 (Essential Indexes)
-- 2. Run section 2 (Partial Indexes)
-- 3. Run section 3 (Full-Text Search) - if needed
-- 4. Run section 5 (Materialized Views) - if needed
-- 5. Run section 8 (VACUUM and ANALYZE)
-- 6. Run section 9 (Performance Monitoring)
-- 7. Run load tests
-- 8. Monitor with monitoring-queries.sql
-- 9. Adjust based on results
