-- Re-enable RLS on merchant_subscriptions table
ALTER TABLE merchant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Merchants can view own subscriptions" ON merchant_subscriptions;
DROP POLICY IF EXISTS "Merchants can insert own subscriptions" ON merchant_subscriptions;
DROP POLICY IF EXISTS "Merchants can update own subscriptions" ON merchant_subscriptions;

-- Policy 1: Allow merchants to SELECT only their own subscriptions
CREATE POLICY "Merchants can view own subscriptions"
ON merchant_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = merchant_id);

-- Note: We do NOT create INSERT/UPDATE/DELETE policies
-- All writes must go through the Edge Function which uses service role key
-- This prevents direct manipulation of subscriptions from the client

-- Verify policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'merchant_subscriptions';
