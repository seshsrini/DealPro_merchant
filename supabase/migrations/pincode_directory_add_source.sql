-- Track where each pincode_directory row came from, so merchant-contributed
-- localities (crowd-sourced during signup) are distinguishable from the official
-- India Post import — useful for future moderation/cleanup. Existing rows
-- backfill to 'india_post' via the column default.

ALTER TABLE public.pincode_directory
  ADD COLUMN IF NOT EXISTS source      text DEFAULT 'india_post',
  ADD COLUMN IF NOT EXISTS merchant_id uuid;

-- Speeds up the "does this (pincode, locality) already exist?" dedupe check the
-- store-save function runs before contributing a new locality.
CREATE INDEX IF NOT EXISTS idx_pincode_directory_pincode_lower_locality
  ON public.pincode_directory (pincode, lower(locality));
