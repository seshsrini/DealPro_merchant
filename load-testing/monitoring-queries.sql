-- DealPro Database Performance Monitoring Queries
-- Run these during load tests to identify bottlenecks

-- 1. Active database connections
SELECT count(*) as active_connections,
       state,
       wait_event_type,
       wait_event
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, wait_event_type, wait_event
ORDER BY active_connections DESC;

-- 2. Slowest queries
SELECT
  query,
  calls,
  total_exec_time / 1000 as total_time_seconds,
  mean_exec_time / 1000 as mean_time_seconds,
  max_exec_time / 1000 as max_time_seconds
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 3. Table sizes and bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. Index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 20;

-- 5. Cache hit ratio (should be > 99%)
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit) as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
FROM pg_statio_user_tables;

-- 6. Most accessed tables
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables
ORDER BY (seq_scan + idx_scan) DESC
LIMIT 20;

-- 7. Locks and blocking queries
SELECT
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement,
  blocked_activity.application_name AS blocked_app,
  blocking_activity.application_name AS blocking_app
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 8. Dead tuples (high numbers indicate need for VACUUM)
SELECT
  schemaname,
  tablename,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  round(n_dead_tup::numeric / NULLIF(n_live_tup, 0) * 100, 2) as dead_ratio_percent,
  last_autovacuum,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 100
ORDER BY n_dead_tup DESC;

-- 9. Long-running queries (> 5 seconds)
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  usename,
  query,
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state != 'idle'
ORDER BY duration DESC;

-- 10. Transaction ID wraparound risk
SELECT
  datname,
  age(datfrozenxid) as xid_age,
  pg_size_pretty(pg_database_size(datname)) as db_size,
  CASE
    WHEN age(datfrozenxid) > 1000000000 THEN 'CRITICAL - VACUUM NOW!'
    WHEN age(datfrozenxid) > 500000000 THEN 'WARNING'
    ELSE 'OK'
  END as status
FROM pg_database
ORDER BY age(datfrozenxid) DESC;

-- 11. Query plan for specific slow query
-- Example: Check campaigns query performance
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM campaigns
WHERE city = 'Bangalore'
  AND status = 'active'
  AND start_date <= CURRENT_DATE
  AND end_date >= CURRENT_DATE
ORDER BY start_date DESC
LIMIT 20;

-- 12. Find missing indexes
SELECT
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / NULLIF(seq_scan, 0) as avg_seq_read
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND idx_scan = 0
  AND schemaname = 'public'
ORDER BY seq_tup_read DESC;
