-- DealFynd catalogue — browse helpers for the merchant app (DEV ONLY for now).
-- Run after create_catalog_master.sql + seeds. Safe to re-run.
-- Called only by the catalog-browse edge function (service role).

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
  added boolean, total bigint)
LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT nullif(lower(trim(coalesce(p_query, ''))), '') AS t),
  cat AS (SELECT id FROM public.catalog_categories WHERE slug = p_category),
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
                      WHERE al.product_id = p.id AND al.alias ILIKE '%' || q.t || '%'))
  )
  SELECT h.id, h.code, h.name, h.description, h.image_url,
         c.slug, c.name,
         coalesce(s.slug, c.slug), coalesce(s.name, c.name),
         coalesce(c.schema_id, s.schema_id),
         h.is_restricted OR coalesce(c.is_restricted, false),
         h.attributes->>'diet',
         coalesce((SELECT jsonb_agg(jsonb_build_object(
                     'id', v.id, 'label', v.variant_label, 'qty', v.net_quantity,
                     'unit', v.unit, 'mrp', v.mrp) ORDER BY v.created_at, v.id)
                   FROM public.catalog_variants v
                   WHERE v.product_id = h.id AND v.status = 'active'), '[]'::jsonb),
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
