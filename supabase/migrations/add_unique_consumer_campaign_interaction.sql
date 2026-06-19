-- Hard-guarantee ONE claim per (consumer, campaign). The unique per-campaign-
-- per-user code lives in campaign_interactions.claim_no; this constraint enforces
-- a single interaction row per consumer+campaign at the DB level. create-claim
-- already checks this in app logic — the constraint makes it race-proof.

-- 1) Remove any pre-existing duplicates first (so the unique index can build),
--    keeping the most relevant row per (consumer_id, campaign_id): a redeemed
--    one if present, else the most recent. Duplicates shouldn't exist (app logic
--    blocks them) — this is a safety net.
WITH ranked AS (
  SELECT interaction_id,
         ROW_NUMBER() OVER (
           PARTITION BY consumer_id, campaign_id
           ORDER BY is_redeemed DESC NULLS LAST, click_at DESC NULLS LAST, interaction_id DESC
         ) AS rn
  FROM campaign_interactions
  WHERE consumer_id IS NOT NULL AND campaign_id IS NOT NULL
)
DELETE FROM campaign_interactions
WHERE interaction_id IN (SELECT interaction_id FROM ranked WHERE rn > 1);

-- 2) Enforce uniqueness going forward.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_interactions_consumer_campaign_unique
  ON campaign_interactions (consumer_id, campaign_id);
