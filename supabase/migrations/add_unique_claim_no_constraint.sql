-- Migration: Add UNIQUE constraint to claim_no in campaign_interactions table
-- This ensures that no two claims can have the same claim_no value
--
-- Claim Number Format: 1 uppercase letter (A-Z) + 6 digits (0-9)
-- Example: A123456, B987654, C000001
-- Total Length: 7 characters
--
-- First, check if there are any existing duplicate claim_no values
-- Run this query to identify duplicates before applying the constraint:
-- SELECT claim_no, COUNT(*)
-- FROM campaign_interactions
-- WHERE claim_no IS NOT NULL
-- GROUP BY claim_no
-- HAVING COUNT(*) > 1;

-- If duplicates exist, you need to fix them first by updating one of the duplicates
-- For example: UPDATE campaign_interactions SET claim_no = 'NEW_UNIQUE_VALUE' WHERE interaction_id = <id_of_duplicate>;

-- Add the UNIQUE constraint to the claim_no column
ALTER TABLE campaign_interactions
ADD CONSTRAINT campaign_interactions_claim_no_unique UNIQUE (claim_no);

-- Add CHECK constraint to enforce format: 1 letter (A-Z) + 6 digits (0-9)
-- This provides database-level validation to ensure claim_no always follows the correct pattern
ALTER TABLE campaign_interactions
ADD CONSTRAINT campaign_interactions_claim_no_format_check
CHECK (claim_no ~ '^[A-Z][0-9]{6}$');

-- Add an index for better query performance on claim_no lookups
CREATE INDEX IF NOT EXISTS idx_campaign_interactions_claim_no
ON campaign_interactions(claim_no);
