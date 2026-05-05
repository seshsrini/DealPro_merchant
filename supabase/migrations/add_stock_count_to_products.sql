-- Add a dedicated stock_count column to the products table.
--
-- Previously stock was stored inside the attributes jsonb as the strings
-- 'in_stock' / 'limited' / 'out_of_stock', which caused the consumer app to
-- mis-interpret it as a numeric stock count and show every product as
-- "Out of Stock". Promoting it to a real column also lets merchants edit it
-- independently of the rest of the product (e.g. via a quick inline toggle
-- in the catalogue list).
--
-- Encoding (single nullable INT column):
--   NULL  → "10+" / Available (default — plenty in stock)
--   0     → Out of Stock
--   1..10 → exact remaining count (low-stock warning)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_count INT NULL
    CHECK (stock_count IS NULL OR (stock_count >= 0 AND stock_count <= 10));

-- Backfill from the legacy attributes.stock value where present.
--   'in_stock'      → NULL (plenty)
--   'limited'       → 5    (mid-range warning)
--   'out_of_stock'  → 0
UPDATE products
   SET stock_count = CASE attributes->>'stock'
                       WHEN 'in_stock'     THEN NULL
                       WHEN 'limited'      THEN 5
                       WHEN 'out_of_stock' THEN 0
                     END
 WHERE attributes ? 'stock';

-- Index for "show only available products" filtering on the consumer side.
-- Treats NULL and >0 as available; 0 as out-of-stock.
CREATE INDEX IF NOT EXISTS idx_products_stock_available
  ON products ((stock_count IS NULL OR stock_count > 0))
  WHERE is_active = true;
