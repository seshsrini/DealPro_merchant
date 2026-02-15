-- Enable RLS on subscription_tiers table (if not already enabled)
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (optional, only if you want to start fresh)
DROP POLICY IF EXISTS "Allow all authenticated users to view active subscription tiers" ON subscription_tiers;

-- Create policy: Allow all authenticated users to SELECT active subscription tiers
CREATE POLICY "Allow all authenticated users to view active subscription tiers"
ON subscription_tiers
FOR SELECT
TO authenticated
USING (is_active = true);

-- Verify the policy
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'subscription_tiers';
