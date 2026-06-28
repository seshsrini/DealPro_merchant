-- Plan upgrade/downgrade scheduling columns used by the merchant-subscription
-- `change_tier` action. Without these, an UPGRADE (writes total_recurring_amount +
-- nulls the pending_* fields) or a DOWNGRADE (parks the new plan in pending_*)
-- fails the UPDATE and the merchant sees "Unable to change plan."
--
-- All are nullable and additive (IF NOT EXISTS), so this is safe to run anytime.
--   * total_recurring_amount → go-forward recurring charge after an upgrade
--   * pending_*              → a downgrade scheduled to apply at the next cycle
ALTER TABLE merchant_subscriptions
  ADD COLUMN IF NOT EXISTS total_recurring_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS pending_tier_id        UUID,
  ADD COLUMN IF NOT EXISTS pending_plan_name      TEXT,
  ADD COLUMN IF NOT EXISTS pending_amount         NUMERIC,
  ADD COLUMN IF NOT EXISTS pending_effective_date TIMESTAMPTZ;
