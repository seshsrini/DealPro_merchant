-- Idempotency for deal publishing. The merchant app generates one stable
-- client_dedup_key per publish attempt and reuses it across automatic retries
-- (network blip / edge-function cold start / transient 5xx). create-campaign
-- checks this key before inserting and the partial unique index below makes a
-- concurrent retry race impossible to duplicate — so the client can retry a
-- failed publish freely without ever creating two deals.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS client_dedup_key TEXT;

-- One key → at most one campaign per merchant. Partial so existing rows (NULL
-- key) are unaffected and only real keys are constrained.
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_merchant_dedup_key_uniq
  ON campaigns (merchant_id, client_dedup_key)
  WHERE client_dedup_key IS NOT NULL;
