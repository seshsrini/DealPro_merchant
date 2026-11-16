-- DealFynd catalogue — additions from DealFynd_Pharmacy_Healthcare_Catalogue.xlsx (Nov 2026).
-- DEV ONLY (like the rest of the catalogue). Safe to re-run.
-- Only what the catalogue didn't already have; the sheet's other rows were duplicates.
-- The sheet's image links (retailer / marketplace / news photos) are NOT used.
--
-- 1. New generic product "Pain Relief Gel" (OTC Pain Relief) with brand Volini, 50 g.
-- 2. New generic product "Anti-Dandruff Shampoo" (Skin Care OTC) with brand Selsun, 60 ml.
-- 3. Brand names on existing prescription generics (restricted, not dealable) so a search
--    for the brand finds the product: Combiflam, Allegra, Asthalin, Augmentin, Azithral, Thyronorm.

BEGIN;

-- ── Brands ──────────────────────────────────────────────────────────────────────
INSERT INTO public.catalog_brands (name, is_verified)   -- normalized_name is a generated column
SELECT v.name, false
FROM (VALUES ('Selsun','selsun'), ('Combiflam','combiflam'), ('Allegra','allegra'),
             ('Asthalin','asthalin'), ('Augmentin','augmentin'), ('Azithral','azithral'),
             ('Thyronorm','thyronorm'), ('Volini','volini')) AS v(name, norm)
WHERE NOT EXISTS (SELECT 1 FROM public.catalog_brands b WHERE b.normalized_name = v.norm);

-- ── New generic products ────────────────────────────────────────────────────────
INSERT INTO public.catalog_products
  (code, name, is_generic, category_id, description, hsn_code, gst_rate, attributes, is_restricted, source, source_ref, verified, status)
VALUES
  ('DFE-pain-relief-gel', 'Pain Relief Gel', true, 151,
   'Topical gel for muscle, joint and back pain.', '3004', 5.00,
   '{"subcategory":"OTC Pain Relief"}', false, 'import', 'DFPH0007', false, 'active'),
  ('DFE-anti-dandruff-shampoo', 'Anti-Dandruff Shampoo', true, 157,
   'Medicated shampoo for dandruff and itchy scalp.', NULL, NULL,
   '{"subcategory":"Skin Care OTC"}', false, 'import', 'DFPH0014', false, 'active')
ON CONFLICT (code) DO NOTHING;

-- Pack sizes from the sheet
INSERT INTO public.catalog_variants (product_id, variant_label, net_quantity, unit, status)
SELECT p.id, v.label, v.qty, v.unit, 'active'
FROM (VALUES ('DFE-pain-relief-gel', '50 g', 50, 'g'),
             ('DFE-anti-dandruff-shampoo', '60 ml', 60, 'ml')) AS v(code, label, qty, unit)
JOIN public.catalog_products p ON p.code = v.code
WHERE NOT EXISTS (SELECT 1 FROM public.catalog_variants x WHERE x.product_id = p.id AND x.variant_label = v.label);

-- Same shop types as their sister products (Pain Relief Spray; another Skin Care OTC product)
INSERT INTO public.catalog_product_merchant_categories (product_id, merchant_category_id)
SELECT n.id, m.merchant_category_id
FROM public.catalog_products n
JOIN public.catalog_products s ON s.code = 'DFE-pain-relief-spray'
JOIN public.catalog_product_merchant_categories m ON m.product_id = s.id
WHERE n.code = 'DFE-pain-relief-gel'
  AND NOT EXISTS (SELECT 1 FROM public.catalog_product_merchant_categories x
                  WHERE x.product_id = n.id AND x.merchant_category_id = m.merchant_category_id);

INSERT INTO public.catalog_product_merchant_categories (product_id, merchant_category_id)
SELECT n.id, m.merchant_category_id
FROM public.catalog_products n
JOIN LATERAL (SELECT s.id FROM public.catalog_products s
              WHERE s.category_id = 157 AND s.code <> 'DFE-anti-dandruff-shampoo'
                AND EXISTS (SELECT 1 FROM public.catalog_product_merchant_categories y WHERE y.product_id = s.id)
              ORDER BY s.code LIMIT 1) s ON true
JOIN public.catalog_product_merchant_categories m ON m.product_id = s.id
WHERE n.code = 'DFE-anti-dandruff-shampoo'
  AND NOT EXISTS (SELECT 1 FROM public.catalog_product_merchant_categories x
                  WHERE x.product_id = n.id AND x.merchant_category_id = m.merchant_category_id);

-- ── Brand ↔ product links ───────────────────────────────────────────────────────
INSERT INTO public.catalog_product_brands (product_id, brand_id, sort_order, source)
SELECT p.id, b.id,
       coalesce((SELECT max(sort_order) + 1 FROM public.catalog_product_brands z WHERE z.product_id = p.id), 0),
       'import'
FROM (VALUES ('Pain Relief Gel', 'volini'),
             ('Anti-Dandruff Shampoo', 'selsun'),
             ('Ibuprofen and Paracetamol Tablet', 'combiflam'),
             ('Fexofenadine Tablet', 'allegra'),
             ('Salbutamol Inhaler', 'asthalin'),
             ('Amoxicillin and Clavulanic Acid Tablet', 'augmentin'),
             ('Azithromycin Tablet', 'azithral'),
             ('Levothyroxine Tablet', 'thyronorm')) AS v(product, brand)
JOIN public.catalog_products p ON p.name = v.product AND p.is_generic AND p.status = 'active'
JOIN public.catalog_brands b ON b.normalized_name = v.brand
WHERE NOT EXISTS (SELECT 1 FROM public.catalog_product_brands x WHERE x.product_id = p.id AND x.brand_id = b.id);

COMMIT;

-- Check
SELECT p.name, c.name AS category, p.is_restricted,
       (SELECT string_agg(variant_label, ', ') FROM public.catalog_variants v WHERE v.product_id = p.id) AS packs,
       (SELECT string_agg(b.name, ', ' ORDER BY pb.sort_order) FROM public.catalog_product_brands pb
          JOIN public.catalog_brands b ON b.id = pb.brand_id WHERE pb.product_id = p.id) AS brands,
       (SELECT count(*) FROM public.catalog_product_merchant_categories m WHERE m.product_id = p.id) AS shop_types
FROM public.catalog_products p JOIN public.catalog_categories c ON c.id = p.category_id
WHERE p.name IN ('Pain Relief Gel', 'Anti-Dandruff Shampoo', 'Ibuprofen and Paracetamol Tablet', 'Fexofenadine Tablet',
                 'Salbutamol Inhaler', 'Amoxicillin and Clavulanic Acid Tablet', 'Azithromycin Tablet', 'Levothyroxine Tablet')
  AND p.is_generic
ORDER BY p.is_restricted, p.name;
