-- DealFynd catalogue — merchant product photos. DEV ONLY (like the rest of the catalogue). Safe to re-run.
--
-- 1. A catalogue photo reaches merchants' products: whenever catalog_products.image_url changes (new AI
--    photo, an owner upload, or an approved merchant photo), every merchant product linked to it
--    picks up the new photo, unless the merchant put their own photo on it (attributes.photo_source
--    = 'merchant') or set a different one.
-- 2. Catch-up: products added before their catalogue photo existed get it now.
-- Merchant photos offered for the catalogue itself are catalog_images rows with source 'merchant',
-- moderation_status 'pending' (written by the catalog-browse set_photo action; an owner approves them
-- on vedicjaalam.com, Admin, Product Catalogue).

CREATE OR REPLACE FUNCTION public.catalog_propagate_image() RETURNS trigger AS $$
BEGIN
  IF NEW.image_url IS NOT NULL AND (OLD.image_url IS NULL OR NEW.image_url <> OLD.image_url) THEN
    UPDATE public.products p
       SET image_url = NEW.image_url
     WHERE p.catalog_product_id = NEW.id
       AND coalesce(p.attributes->>'photo_source', '') <> 'merchant'
       AND (p.image_url IS NULL OR p.image_url = OLD.image_url);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS catalog_products_propagate_image ON public.catalog_products;
CREATE TRIGGER catalog_products_propagate_image
  AFTER UPDATE OF image_url ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.catalog_propagate_image();

CREATE INDEX IF NOT EXISTS catalog_images_merchant_pending_idx
  ON public.catalog_images (product_id) WHERE source = 'merchant' AND moderation_status = 'pending';

-- Catch-up for products added before their catalogue photo existed.
UPDATE public.products p
   SET image_url = c.image_url
  FROM public.catalog_products c
 WHERE p.catalog_product_id = c.id
   AND p.image_url IS NULL
   AND c.image_url IS NOT NULL
   AND coalesce(p.attributes->>'photo_source', '') <> 'merchant';

SELECT
  (SELECT count(*) FROM public.products WHERE catalog_product_id IS NOT NULL) AS catalogue_products_added,
  (SELECT count(*) FROM public.products WHERE catalog_product_id IS NOT NULL AND image_url IS NULL) AS still_without_photo,
  (SELECT count(*) FROM public.catalog_images WHERE source = 'merchant' AND moderation_status = 'pending') AS merchant_photos_to_review;
