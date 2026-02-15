-- Database Schema Discovery
-- Run this in Supabase SQL Editor to find your actual table names

-- =============================================================================
-- 1. LIST ALL TABLES IN YOUR DATABASE
-- =============================================================================

SELECT
    schemaname as schema,
    tablename as table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- =============================================================================
-- 2. FIND USER-RELATED TABLES
-- =============================================================================

SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname IN ('public', 'auth')
  AND (
    tablename ILIKE '%user%'
    OR tablename ILIKE '%profile%'
    OR tablename ILIKE '%member%'
    OR tablename ILIKE '%account%'
  )
ORDER BY schemaname, tablename;

-- =============================================================================
-- 3. CHECK SUPABASE AUTH USERS TABLE
-- =============================================================================

-- Supabase has a built-in auth.users table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'auth'
  AND table_name = 'users'
ORDER BY ordinal_position;

-- =============================================================================
-- 4. CHECK FOR PROFILES/CUSTOM USER TABLE IN PUBLIC SCHEMA
-- =============================================================================

SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'users', 'members', 'user_profiles')
ORDER BY table_name, ordinal_position;

-- =============================================================================
-- 5. FIND CAMPAIGNS TABLE STRUCTURE
-- =============================================================================

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'campaigns'
ORDER BY ordinal_position;

-- =============================================================================
-- 6. FIND ALL PUBLIC TABLES (your app tables)
-- =============================================================================

SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
