-- ────────────────────────────────────────────────────────────────────────
-- Marks merchant subscriptions created via the in-app test bypass so they
-- can be cleaned up wholesale before the production launch and so analytics
-- queries can exclude test data:
--
--   DELETE FROM merchant_subscriptions WHERE is_test_subscription = true;
--
-- The bypass button itself is gated by VITE_ALLOW_TEST_SUBSCRIPTION at the
-- client; this column is just the server-side label so we never lose the
-- distinction even if the client flag is flipped.
-- ────────────────────────────────────────────────────────────────────────

ALTER TABLE public.merchant_subscriptions
  ADD COLUMN IF NOT EXISTS is_test_subscription boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS merchant_subscriptions_is_test_idx
  ON public.merchant_subscriptions (is_test_subscription)
  WHERE is_test_subscription = true;
