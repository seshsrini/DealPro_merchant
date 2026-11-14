-- ============================================================================
-- DealFynd catalogue master — PROD setup (schema only, no data). Safe to re-run.
-- Run this ONCE in the PROD SQL editor (project trrinhrajmsnkjnwtncz).
-- The data is then copied from DEV on vedicjaalam.com: Admin → Product Catalogue →
-- Database: PROD → "Copy DEV → PROD". The merchant app shows the catalogue as soon as
-- the catalog-browse edge function is deployed to PROD.
--
-- = create_catalog_master.sql + catalog_browse.sql + catalog_merchant_photos.sql
--   + catalog_sync_finish() used by the copy.
-- ============================================================================

-- ##### create_catalog_master.sql #####
-- ============================================================================
-- DealFynd Retail Catalogue Master — schema (DEV first; safe to re-run)
-- ============================================================================
-- Merchant Category → Product Type/Category → Product → Variant (pack/SKU)
--                                                   → merchant's own listing (products)
--                                                   → deal (campaigns)
--
--   catalog_categories          product taxonomy: 27 sectors (level 1) + restricted
--                               sub-categories; ONDC domain mapping
--   catalog_merchant_categories 500 shop types (Kirana Store, Chicken Shop, …)
--   catalog_brands              brand master
--   catalog_manufacturers       manufacturer master
--   catalog_products            the product. is_generic = a generic product type
--                               ("Toor Dal"); branded products ("Tata Sampann
--                               Toor Dal") reference brand/manufacturer
--   catalog_variants            pack/size/SKU, barcode (GTIN) unique, MRP
--   catalog_product_merchant_categories  which shop types sell a product
--   catalog_aliases             search synonyms / local-language names
--   catalog_images              photos with source + licence; synced to image_url
--   catalog_sources             provenance trail (where a fact came from)
--   products.catalog_product_id / products.catalog_variant_id
--                               merchant listing → master (optional)
--
-- Photos: every category/shop type/product/variant has image_url. A BRANDED
-- product can only be 'active' with a photo; generic product types may be active
-- without one. Restricted categories (prescription medicines, tobacco, alcohol)
-- can be catalogued but are never dealable.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Product taxonomy ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_categories (
  id            bigserial PRIMARY KEY,
  parent_id     bigint REFERENCES public.catalog_categories(id) ON DELETE RESTRICT,
  slug          text NOT NULL UNIQUE,
  name          text NOT NULL,
  level         smallint NOT NULL CHECK (level BETWEEN 1 AND 4),
  schema_id     text,                 -- merchant app spec-form schema (grocery, fashion, …)
  is_restricted boolean NOT NULL DEFAULT false,
  ondc_code     text,                 -- ONDC retail domain, e.g. 'ONDC:RET10'
  ondc_category text,
  image_url     text,
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catalog_categories_parent_idx ON public.catalog_categories (parent_id);

-- ── Shop types ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_merchant_categories (
  id          text PRIMARY KEY,                        -- 'MC0001'
  name        text NOT NULL,                           -- 'Kirana Store'
  sector_id   bigint REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  channel     text,                                    -- 'Retail', 'Wholesale', …
  image_url   text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_merchant_categories_name_key ON public.catalog_merchant_categories (lower(name));

-- ── Brands / manufacturers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_manufacturers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name   text NOT NULL,
  country      text DEFAULT 'India',
  website      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_manufacturers_name_key ON public.catalog_manufacturers (lower(legal_name));

CREATE TABLE IF NOT EXISTS public.catalog_brands (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  normalized_name  text GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '', 'g'))) STORED,
  manufacturer_id  uuid REFERENCES public.catalog_manufacturers(id) ON DELETE SET NULL,
  logo_url         text,
  is_verified      boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_brands_normalized_key ON public.catalog_brands (normalized_name);
CREATE INDEX IF NOT EXISTS catalog_brands_name_trgm ON public.catalog_brands USING gin (name gin_trgm_ops);

-- ── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text UNIQUE,                  -- stable external code, e.g. 'DFT00001'
  name                  text NOT NULL,                -- 'Toor Dal' / 'Tata Sampann Toor Dal'
  is_generic            boolean NOT NULL DEFAULT false,
  generic_product_id    uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL, -- branded → its generic type
  brand_id              uuid REFERENCES public.catalog_brands(id) ON DELETE SET NULL,
  manufacturer_id       uuid REFERENCES public.catalog_manufacturers(id) ON DELETE SET NULL,
  category_id           bigint REFERENCES public.catalog_categories(id) ON DELETE SET NULL,
  description           text,
  hsn_code              text CHECK (hsn_code IS NULL OR hsn_code ~ '^[0-9]{4,8}$'),
  gst_rate              numeric(5,2) CHECK (gst_rate IS NULL OR gst_rate BETWEEN 0 AND 40),
  country_of_origin     text,
  image_url             text,                         -- primary photo (synced from catalog_images when present)
  attributes            jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_restricted         boolean NOT NULL DEFAULT false,
  source                text NOT NULL DEFAULT 'admin'
                          CHECK (source IN ('admin','merchant','gs1','open_food_facts','brand_feed','ai','import')),
  source_ref            text,
  verified              boolean NOT NULL DEFAULT false,
  status                text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending_review','rejected','merged')),
  merged_into           uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  submitted_by_merchant uuid,
  search                tsvector GENERATED ALWAYS AS (
                          to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
                        ) STORED,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- Branded products need a photo to go live; generic types may not have one yet.
  CONSTRAINT catalog_products_active_needs_photo CHECK (status <> 'active' OR is_generic OR image_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS catalog_products_category_idx ON public.catalog_products (category_id);
CREATE INDEX IF NOT EXISTS catalog_products_brand_idx    ON public.catalog_products (brand_id);
CREATE INDEX IF NOT EXISTS catalog_products_status_idx   ON public.catalog_products (status);
CREATE INDEX IF NOT EXISTS catalog_products_search_idx   ON public.catalog_products USING gin (search);
CREATE INDEX IF NOT EXISTS catalog_products_name_trgm    ON public.catalog_products USING gin (name gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_products_source_ref_key
  ON public.catalog_products (source, source_ref) WHERE source_ref IS NOT NULL;

-- ── Variants (pack / size / SKU) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_variants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  gtin           text CHECK (gtin IS NULL OR gtin ~ '^[0-9]{8}$|^[0-9]{12,14}$'),
  variant_label  text,                                 -- '500 g', 'Black / UK 8'
  net_quantity   numeric(12,3),
  unit           text CHECK (unit IS NULL OR unit IN ('g','kg','mg','ml','l','pcs','pack','m','cm','tablet','capsule','strip','pair','set')),
  pack_count     int CHECK (pack_count IS NULL OR pack_count > 0),
  size           text,
  color          text,
  mrp            numeric(12,2) CHECK (mrp IS NULL OR mrp >= 0),
  mrp_source     text CHECK (mrp_source IS NULL OR mrp_source IN ('pack','brand','gov','merchant','import')),
  mrp_updated_at timestamptz,
  image_url      text,
  attributes     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending_review','rejected','discontinued')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_variants_gtin_key ON public.catalog_variants (gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS catalog_variants_product_idx ON public.catalog_variants (product_id);

-- ── Which shop types sell a product ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_product_merchant_categories (
  product_id           uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  merchant_category_id text NOT NULL REFERENCES public.catalog_merchant_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, merchant_category_id)
);
CREATE INDEX IF NOT EXISTS catalog_pmc_category_idx ON public.catalog_product_merchant_categories (merchant_category_id);

-- ── Search aliases / local names ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_aliases (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  alias       text NOT NULL,
  language    text NOT NULL DEFAULT 'en',   -- 'en', 'hi', 'kn', 'ta', …
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_aliases_key ON public.catalog_aliases (product_id, lower(alias), language);
CREATE INDEX IF NOT EXISTS catalog_aliases_trgm ON public.catalog_aliases USING gin (alias gin_trgm_ops);

-- ── Photos (source + licence recorded) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_images (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  variant_id        uuid REFERENCES public.catalog_variants(id) ON DELETE CASCADE,
  storage_path      text,                   -- path in the catalog-images bucket (when we host it)
  url               text NOT NULL,
  is_primary        boolean NOT NULL DEFAULT false,
  angle             text CHECK (angle IS NULL OR angle IN ('front','back','side','pack','label','in_use','other')),
  width             int,
  height            int,
  source            text NOT NULL CHECK (source IN ('brand','gs1','merchant','open_food_facts','admin','ai_cleaned','ai_generated')),
  license           text NOT NULL DEFAULT 'platform',
  attribution       text,
  submitted_by_merchant uuid,
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','approved','rejected')),
  moderation_note   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_images_min_size CHECK (width IS NULL OR height IS NULL OR (width >= 400 AND height >= 400)),
  CONSTRAINT catalog_images_cc_attribution CHECK (license NOT LIKE 'CC-%' OR attribution IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS catalog_images_product_idx ON public.catalog_images (product_id);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_images_one_primary_product
  ON public.catalog_images (product_id) WHERE is_primary AND variant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS catalog_images_one_primary_variant
  ON public.catalog_images (variant_id) WHERE is_primary AND variant_id IS NOT NULL;

-- ── Provenance ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_sources (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  variant_id   uuid REFERENCES public.catalog_variants(id) ON DELETE CASCADE,
  source_name  text NOT NULL,          -- 'DealFynd Phase 1 workbook', 'Open Food Facts', …
  source_url   text,
  field        text,                   -- which fact (e.g. 'mrp', 'gtin'); NULL = the whole record
  observed_at  timestamptz NOT NULL DEFAULT now(),
  confidence   numeric(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS catalog_sources_product_idx ON public.catalog_sources (product_id);

-- ── Approved primary photo → image_url (product or variant) ──────────────────
CREATE OR REPLACE FUNCTION public.catalog_sync_primary_image() RETURNS trigger AS $$
DECLARE pid uuid; vid uuid; best text;
BEGIN
  pid := coalesce(NEW.product_id, OLD.product_id);
  vid := coalesce(NEW.variant_id, OLD.variant_id);
  IF vid IS NULL THEN
    SELECT i.url INTO best FROM public.catalog_images i
    WHERE i.product_id = pid AND i.variant_id IS NULL AND i.moderation_status = 'approved'
    ORDER BY i.is_primary DESC, i.created_at LIMIT 1;
    -- Keep a manually entered image_url when there is no approved catalogue photo.
    IF best IS NOT NULL THEN UPDATE public.catalog_products SET image_url = best WHERE id = pid; END IF;
  ELSE
    SELECT i.url INTO best FROM public.catalog_images i
    WHERE i.variant_id = vid AND i.moderation_status = 'approved'
    ORDER BY i.is_primary DESC, i.created_at LIMIT 1;
    IF best IS NOT NULL THEN UPDATE public.catalog_variants SET image_url = best WHERE id = vid; END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS catalog_images_sync ON public.catalog_images;
CREATE TRIGGER catalog_images_sync AFTER INSERT OR UPDATE OR DELETE ON public.catalog_images
  FOR EACH ROW EXECUTE FUNCTION public.catalog_sync_primary_image();

INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-images', 'catalog-images', true)
ON CONFLICT (id) DO NOTHING;

-- ── Merchant listing → master (both optional; existing listings unaffected) ──
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS catalog_product_id uuid
  REFERENCES public.catalog_products(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS catalog_variant_id uuid
  REFERENCES public.catalog_variants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS products_catalog_product_idx ON public.products (catalog_product_id);
CREATE INDEX IF NOT EXISTS products_catalog_variant_idx ON public.products (catalog_variant_id);

-- ── updated_at ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.catalog_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS catalog_products_touch ON public.catalog_products;
CREATE TRIGGER catalog_products_touch BEFORE UPDATE ON public.catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();
DROP TRIGGER IF EXISTS catalog_variants_touch ON public.catalog_variants;
CREATE TRIGGER catalog_variants_touch BEFORE UPDATE ON public.catalog_variants
  FOR EACH ROW EXECUTE FUNCTION public.catalog_touch_updated_at();

-- ── Access: signed-in users read active rows; writes via service role only ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['catalog_categories','catalog_merchant_categories','catalog_manufacturers','catalog_brands',
    'catalog_products','catalog_variants','catalog_product_merchant_categories','catalog_aliases','catalog_images','catalog_sources']
  LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t); END LOOP;
END $$;

DROP POLICY IF EXISTS catalog_categories_read ON public.catalog_categories;
CREATE POLICY catalog_categories_read ON public.catalog_categories FOR SELECT TO authenticated USING (is_active);
DROP POLICY IF EXISTS catalog_merchant_categories_read ON public.catalog_merchant_categories;
CREATE POLICY catalog_merchant_categories_read ON public.catalog_merchant_categories FOR SELECT TO authenticated USING (is_active);
DROP POLICY IF EXISTS catalog_brands_read ON public.catalog_brands;
CREATE POLICY catalog_brands_read ON public.catalog_brands FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_products_read ON public.catalog_products;
CREATE POLICY catalog_products_read ON public.catalog_products FOR SELECT TO authenticated USING (status = 'active');
DROP POLICY IF EXISTS catalog_variants_read ON public.catalog_variants;
CREATE POLICY catalog_variants_read ON public.catalog_variants FOR SELECT TO authenticated USING (status = 'active');
DROP POLICY IF EXISTS catalog_pmc_read ON public.catalog_product_merchant_categories;
CREATE POLICY catalog_pmc_read ON public.catalog_product_merchant_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_aliases_read ON public.catalog_aliases;
CREATE POLICY catalog_aliases_read ON public.catalog_aliases FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_images_read ON public.catalog_images;
CREATE POLICY catalog_images_read ON public.catalog_images FOR SELECT TO authenticated USING (moderation_status = 'approved');

-- ── Lookups for the merchant app ─────────────────────────────────────────────
-- Barcode → variant + product.
CREATE OR REPLACE FUNCTION public.catalog_lookup_gtin(p_gtin text)
RETURNS TABLE (
  variant_id uuid, product_id uuid, product_name text, brand text, variant_label text,
  mrp numeric, image_url text, category text, schema_id text, hsn_code text, gst_rate numeric, dealable boolean
) LANGUAGE sql STABLE AS $$
  SELECT v.id, p.id, p.name, b.name, v.variant_label, v.mrp, coalesce(v.image_url, p.image_url),
         c.name, c.schema_id, p.hsn_code, p.gst_rate,
         NOT (p.is_restricted OR coalesce(c.is_restricted, false))
  FROM public.catalog_variants v
  JOIN public.catalog_products p ON p.id = v.product_id AND p.status = 'active'
  LEFT JOIN public.catalog_brands b ON b.id = p.brand_id
  LEFT JOIN public.catalog_categories c ON c.id = p.category_id
  WHERE v.gtin = regexp_replace(p_gtin, '\D', '', 'g') AND v.status = 'active'
  LIMIT 1;
$$;

-- Type-ahead from 3 characters: "blo" → Blood Pressure Monitor, …, matching
-- names, aliases (Sooji → Rava/Sooji), brands and categories. An optional shop
-- type puts that shop's products first. Branded products before generic ones.
CREATE OR REPLACE FUNCTION public.catalog_suggest(p_query text, p_merchant_category text DEFAULT NULL, p_limit int DEFAULT 15)
RETURNS TABLE (
  product_id uuid, product_name text, is_generic boolean, brand text, image_url text,
  category text, schema_id text, variant_count int, dealable boolean, for_my_shop boolean
) LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT lower(trim(p_query)) AS t)
  SELECT p.id, p.name, p.is_generic, b.name,
         coalesce(p.image_url, (SELECT v.image_url FROM public.catalog_variants v
                                WHERE v.product_id = p.id AND v.status = 'active' AND v.image_url IS NOT NULL LIMIT 1)),
         c.name, c.schema_id,
         (SELECT count(*)::int FROM public.catalog_variants v WHERE v.product_id = p.id AND v.status = 'active'),
         NOT (p.is_restricted OR coalesce(c.is_restricted, false)),
         EXISTS (SELECT 1 FROM public.catalog_product_merchant_categories m
                 WHERE m.product_id = p.id AND m.merchant_category_id = p_merchant_category)
  FROM public.catalog_products p
  CROSS JOIN q
  LEFT JOIN public.catalog_brands b ON b.id = p.brand_id
  LEFT JOIN public.catalog_categories c ON c.id = p.category_id
  WHERE p.status = 'active'
    AND length(q.t) >= 3
    AND (p.name ILIKE '%' || q.t || '%'
         OR b.name ILIKE q.t || '%'
         OR c.name ILIKE '%' || q.t || '%'
         OR EXISTS (SELECT 1 FROM public.catalog_aliases a WHERE a.product_id = p.id AND a.alias ILIKE '%' || q.t || '%'))
  ORDER BY
    (p_merchant_category IS NOT NULL AND EXISTS (SELECT 1 FROM public.catalog_product_merchant_categories m
       WHERE m.product_id = p.id AND m.merchant_category_id = p_merchant_category)) DESC,
    CASE
      WHEN lower(p.name) LIKE q.t || '%'          THEN 0
      WHEN lower(p.name) LIKE '% ' || q.t || '%'  THEN 1
      WHEN lower(b.name) LIKE q.t || '%'          THEN 2
      ELSE 3
    END,
    p.is_generic,          -- branded first
    p.name
  LIMIT least(greatest(p_limit, 1), 30);
$$;

-- ##### catalog_browse.sql #####
-- DealFynd catalogue — browse helpers for the merchant app (DEV ONLY for now).
-- Run after create_catalog_master.sql + seeds. Safe to re-run.
-- Called only by the catalog-browse edge function (service role).

-- Typical (reference) price per pack size, used to pre-fill the merchant's price box.
ALTER TABLE public.catalog_variants ADD COLUMN IF NOT EXISTS typical_price numeric(12,2)
  CHECK (typical_price IS NULL OR typical_price >= 0);
ALTER TABLE public.catalog_variants ADD COLUMN IF NOT EXISTS typical_price_source text;   -- 'ai_estimate' | 'admin'

-- Brands commonly sold for each generic product (Potato Chips → Lay's, Bingo!, …).
CREATE TABLE IF NOT EXISTS public.catalog_product_brands (
  product_id  uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  brand_id    uuid NOT NULL REFERENCES public.catalog_brands(id) ON DELETE CASCADE,
  sort_order  int  NOT NULL DEFAULT 0,
  source      text NOT NULL DEFAULT 'ai',          -- 'ai' | 'admin' | 'merchant'
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, brand_id)
);
CREATE INDEX IF NOT EXISTS catalog_product_brands_brand_idx ON public.catalog_product_brands (brand_id);
ALTER TABLE public.catalog_product_brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS catalog_product_brands_read ON public.catalog_product_brands;
CREATE POLICY catalog_product_brands_read ON public.catalog_product_brands FOR SELECT TO authenticated USING (true);

-- Return type changed (market_price, brands) — drop the old version first.
DROP FUNCTION IF EXISTS public.catalog_browse(text, text, uuid, int, int);

-- Category tree with active product counts (a sector's count includes its sub-categories).
CREATE OR REPLACE FUNCTION public.catalog_category_tree()
RETURNS TABLE (id bigint, parent_id bigint, slug text, name text, level smallint,
               schema_id text, is_restricted boolean, product_count bigint)
LANGUAGE sql STABLE AS $$
  WITH direct AS (
    SELECT category_id, count(*) AS n
    FROM public.catalog_products
    WHERE status = 'active'
    GROUP BY category_id
  )
  SELECT c.id, c.parent_id, c.slug, c.name, c.level, c.schema_id, c.is_restricted,
         coalesce(d.n, 0) + coalesce((
           SELECT sum(d2.n) FROM public.catalog_categories ch
           JOIN direct d2 ON d2.category_id = ch.id
           WHERE ch.parent_id = c.id), 0)::bigint
  FROM public.catalog_categories c
  LEFT JOIN direct d ON d.category_id = c.id
  WHERE c.is_active
  ORDER BY c.level, c.sort_order, c.name;
$$;

-- Products in a category (sector or sub-category) and/or matching a search,
-- with their pack sizes and whether this merchant already has them.
CREATE OR REPLACE FUNCTION public.catalog_browse(
  p_category text DEFAULT NULL,      -- category slug (sector or sub-category)
  p_query    text DEFAULT NULL,      -- name / regional name search (2+ chars)
  p_merchant uuid DEFAULT NULL,      -- marks products this merchant already listed
  p_limit    int  DEFAULT 40,
  p_offset   int  DEFAULT 0)
RETURNS TABLE (
  product_id uuid, code text, name text, description text, image_url text,
  category_slug text, category_name text, sector_slug text, sector_name text,
  schema_id text, is_restricted boolean, diet text, variants jsonb,
  market_price numeric, market_shops int,      -- for products listed without a pack size
  brands jsonb,                                -- [{id, name}] most common first
  added boolean, total bigint)
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT nullif(lower(trim(coalesce(p_query, ''))), '') AS t),
  cat AS (SELECT id FROM public.catalog_categories WHERE slug = p_category),
  -- What merchants actually charge: median per catalogue product / pack size,
  -- only shown once 3+ different merchants have priced it.
  market AS (
    SELECT mp.catalog_product_id AS product_id, mp.catalog_variant_id AS variant_id,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY (mp.attributes->>'price')::numeric) AS median,
           count(DISTINCT mp.merchant_id)::int AS shops
    FROM public.products mp
    WHERE mp.catalog_product_id IS NOT NULL AND coalesce(mp.is_active, true)
      AND (mp.attributes->>'price') ~ '^[0-9]+(\.[0-9]+)?$'
      AND (mp.attributes->>'price')::numeric > 0
    GROUP BY 1, 2
    HAVING count(DISTINCT mp.merchant_id) >= 3
  ),
  hits AS (
    SELECT p.*
    FROM public.catalog_products p
    LEFT JOIN public.catalog_categories c ON c.id = p.category_id
    CROSS JOIN q
    WHERE p.status = 'active'
      AND (p_category IS NULL
           OR c.id IN (SELECT id FROM cat)
           OR c.parent_id IN (SELECT id FROM cat))
      AND (q.t IS NULL OR length(q.t) < 2
           OR p.name ILIKE '%' || q.t || '%'
           OR EXISTS (SELECT 1 FROM public.catalog_aliases al
                      WHERE al.product_id = p.id AND al.alias ILIKE '%' || q.t || '%')
           OR EXISTS (SELECT 1 FROM public.catalog_product_brands pb
                      JOIN public.catalog_brands b ON b.id = pb.brand_id
                      WHERE pb.product_id = p.id
                        AND (b.name ILIKE q.t || '%'
                             OR b.normalized_name LIKE regexp_replace(q.t, '[^a-z0-9]+', '', 'g') || '%')))
  )
  SELECT h.id, h.code, h.name, h.description, h.image_url,
         c.slug, c.name,
         coalesce(s.slug, c.slug), coalesce(s.name, c.name),
         coalesce(c.schema_id, s.schema_id),
         h.is_restricted OR coalesce(c.is_restricted, false),
         h.attributes->>'diet',
         coalesce((SELECT jsonb_agg(jsonb_build_object(
                     'id', v.id, 'label', v.variant_label, 'qty', v.net_quantity,
                     'unit', v.unit, 'mrp', v.mrp, 'typical', v.typical_price,
                     'market', round(mk.median), 'market_shops', mk.shops) ORDER BY v.net_quantity * CASE WHEN v.unit IN ('kg', 'l') THEN 1000 ELSE 1 END NULLS LAST,
                     CASE WHEN v.variant_label ILIKE 'quarter%' OR v.variant_label ILIKE 'small%' THEN 1
                          WHEN v.variant_label ILIKE 'half%' OR v.variant_label ILIKE 'regular%' THEN 2
                          WHEN v.variant_label ILIKE 'full%' OR v.variant_label ILIKE 'medium%' THEN 3
                          WHEN v.variant_label ILIKE 'family%' OR v.variant_label ILIKE 'large%' THEN 4
                          ELSE 5 END,
                     v.variant_label, v.id)
                   FROM public.catalog_variants v
                   LEFT JOIN market mk ON mk.product_id = h.id AND mk.variant_id = v.id
                   WHERE v.product_id = h.id AND v.status = 'active'), '[]'::jsonb),
         (SELECT round(mk.median) FROM market mk WHERE mk.product_id = h.id AND mk.variant_id IS NULL),
         (SELECT mk.shops FROM market mk WHERE mk.product_id = h.id AND mk.variant_id IS NULL),
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) ORDER BY pb.sort_order, b.name)
                   FROM public.catalog_product_brands pb JOIN public.catalog_brands b ON b.id = pb.brand_id
                   WHERE pb.product_id = h.id), '[]'::jsonb),
         (p_merchant IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.products mp
            WHERE mp.merchant_id = p_merchant AND mp.catalog_product_id = h.id
              AND coalesce(mp.is_active, true))),
         count(*) OVER ()
  FROM hits h
  LEFT JOIN public.catalog_categories c ON c.id = h.category_id
  LEFT JOIN public.catalog_categories s ON s.id = c.parent_id
  CROSS JOIN q
  ORDER BY
    CASE WHEN q.t IS NOT NULL AND lower(h.name) LIKE q.t || '%' THEN 0
         WHEN q.t IS NOT NULL AND lower(h.name) LIKE '% ' || q.t || '%' THEN 1
         WHEN q.t IS NOT NULL AND lower(h.name) LIKE '%' || q.t || '%' THEN 2
         ELSE 3 END,
    h.name
  LIMIT least(greatest(coalesce(p_limit, 40), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

-- Only the service role (edge functions) may call these.
REVOKE ALL ON FUNCTION public.catalog_category_tree() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.catalog_browse(text, text, uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_category_tree() TO service_role;
GRANT EXECUTE ON FUNCTION public.catalog_browse(text, text, uuid, int, int) TO service_role;

SELECT 'catalog browse helpers ready' AS status,
       (SELECT count(*) FROM public.catalog_category_tree()) AS categories;

-- ##### catalog_merchant_photos.sql #####
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

-- ##### Copy helper #####
-- Category ids are copied from DEV as-is; afterwards the id counter must move past them.
CREATE OR REPLACE FUNCTION public.catalog_sync_finish() RETURNS bigint
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT setval(pg_get_serial_sequence('public.catalog_categories', 'id'),
                greatest(coalesce((SELECT max(id) FROM public.catalog_categories), 0), 1));
$$;
REVOKE ALL ON FUNCTION public.catalog_sync_finish() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_sync_finish() TO service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'catalogue schema ready on this database' AS status,
       (SELECT count(*) FROM public.catalog_products) AS products_now;
