-- ============================================================================
-- FCM TOKENS TABLE FOR PUSH NOTIFICATIONS
-- ============================================================================
-- This table stores Firebase Cloud Messaging tokens for each user's device
-- Supports multiple devices per user

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')),
  device_name TEXT, -- Optional: e.g., "iPhone 14 Pro", "Samsung Galaxy S23"
  app_version TEXT, -- Optional: Track app version
  is_active BOOLEAN DEFAULT true, -- Mark token as active/inactive
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW() -- Track when this token was last used for notifications
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for quick user lookup (get all devices for a user)
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id
ON public.fcm_tokens(user_id)
WHERE is_active = true;

-- Index for token lookup (check if token exists)
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_device_token
ON public.fcm_tokens(device_token);

-- Index for cleanup queries (find inactive/old tokens)
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_last_used
ON public.fcm_tokens(last_used_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own tokens
CREATE POLICY "Users can view their own FCM tokens"
ON public.fcm_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own tokens
CREATE POLICY "Users can insert their own FCM tokens"
ON public.fcm_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tokens
CREATE POLICY "Users can update their own FCM tokens"
ON public.fcm_tokens
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own tokens
CREATE POLICY "Users can delete their own FCM tokens"
ON public.fcm_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================================================
-- AUTOMATIC UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_fcm_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fcm_tokens_updated_at
BEFORE UPDATE ON public.fcm_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_fcm_tokens_updated_at();

-- ============================================================================
-- CLEANUP FUNCTION (Optional - Run periodically to remove old tokens)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_fcm_tokens()
RETURNS void AS $$
BEGIN
  -- Delete tokens that haven't been used in 90 days
  DELETE FROM public.fcm_tokens
  WHERE last_used_at < NOW() - INTERVAL '90 days';

  RAISE NOTICE 'Cleaned up old FCM tokens';
END;
$$ LANGUAGE plpgsql;

-- To run cleanup manually:
-- SELECT public.cleanup_old_fcm_tokens();

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify table was created
SELECT
  'fcm_tokens table created successfully' as status,
  COUNT(*) as token_count
FROM public.fcm_tokens;

-- Show table structure
\d public.fcm_tokens;
