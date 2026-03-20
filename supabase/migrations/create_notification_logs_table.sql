-- ============================================================================
-- NOTIFICATION LOGS TABLE
-- ============================================================================
-- Tracks every notification sent (push, email, SMS) to prevent duplicates.
-- Used by send-trial-warning and other notification edge functions.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id   uuid NOT NULL,
  notification_type text NOT NULL,       -- e.g. 'trial_expiry_3day', 'payment_reminder', etc.
  channel       text NOT NULL,           -- 'push', 'email', 'sms'
  recipient     text,                    -- email address, phone number, or device token
  title         text NOT NULL,
  body          text NOT NULL,
  status        text NOT NULL DEFAULT 'sent',  -- 'sent', 'failed', 'skipped'
  error_message text,                    -- populated on failure
  metadata      jsonb DEFAULT '{}'::jsonb,     -- extra context (amount, plan, etc.)
  created_at    timestamptz DEFAULT NOW()
);

-- Index for dedup checks: merchant + type + recent timeframe
CREATE INDEX IF NOT EXISTS idx_notification_logs_dedup
  ON public.notification_logs (merchant_id, notification_type, created_at DESC);

-- Index for admin/reporting queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_type_status
  ON public.notification_logs (notification_type, status, created_at DESC);

-- RLS: only service_role can insert/read (edge functions use service_role key)
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions run with service_role)
-- No user-facing policies needed — merchants don't read this table directly
