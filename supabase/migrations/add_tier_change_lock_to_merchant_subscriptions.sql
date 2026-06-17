-- Plan-change lock: after a merchant upgrades/downgrades, they can't change the
-- plan again until this timestamp (set to at least one billing month out — the
-- later of the next billing date or +30 days). Enforced by the merchant-subscription
-- edge function's change_tier action.
ALTER TABLE merchant_subscriptions
  ADD COLUMN IF NOT EXISTS tier_change_locked_until TIMESTAMPTZ;
