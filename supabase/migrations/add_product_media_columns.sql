-- Add multi-image + single-video support to the products table.
--
-- Until now each product had a single image_url. Merchants want to upload
-- up to 5 images plus 1 short video to better showcase their items.
--
-- Layout:
--   image_url         TEXT     — primary "cover" image (unchanged, used in
--                                grids/lists and as the AI analysis subject)
--   additional_images JSONB    — array of up to 4 extra image URLs
--                                (cover + extras = 5 images total)
--   video_url         TEXT NULL — single optional product video URL
--
-- Existing rows are unaffected: additional_images defaults to '[]' and
-- video_url is nullable.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS additional_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_url         TEXT  NULL;

-- Soft cap at 4 extras (the cover image lives in image_url).
ALTER TABLE products
  ADD CONSTRAINT products_additional_images_max_4
    CHECK (jsonb_typeof(additional_images) = 'array' AND jsonb_array_length(additional_images) <= 4);
