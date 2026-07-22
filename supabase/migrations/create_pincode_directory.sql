-- Full India pincode directory — powers the signup "add store" pincode autocomplete
-- (type >=3 digits -> suggestions of "pincode (locality, city)").
--
-- Kept DELIBERATELY SEPARATE from public.localities: that table is lazily
-- populated by lookup-pincode and read with .eq(pincode).maybeSingle(), so we do
-- NOT want to flood it with 150k+ multi-row-per-pincode records. This directory
-- is a read-only reference table just for prefix search.
--
-- Data source: dpnkrpl/indian-pincodes-database (WTFPL), derived from the India
-- Post "All India Pincode Directory" (data.gov.in, GODL-India). Loaded via
-- scripts/import-pincodes.mjs.

CREATE TABLE IF NOT EXISTS public.pincode_directory (
  id       bigserial PRIMARY KEY,
  pincode  text NOT NULL,          -- 6-digit PIN
  locality text NOT NULL,          -- post office / area name (e.g. "Marathahalli")
  city     text,                   -- e.g. "Bangalore"
  district text,                   -- e.g. "Bengaluru Urban"
  state    text                    -- e.g. "Karnataka"
);

-- Prefix search (WHERE pincode LIKE '560%'). text_pattern_ops makes LIKE 'x%'
-- index-usable regardless of the database's collation.
CREATE INDEX IF NOT EXISTS idx_pincode_directory_prefix
  ON public.pincode_directory (pincode text_pattern_ops);

-- Public postal data. The autocomplete runs during signup (the merchant may not
-- have a full session yet), so allow read to anon + authenticated. No writes.
ALTER TABLE public.pincode_directory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pincode_directory public read" ON public.pincode_directory;
CREATE POLICY "pincode_directory public read"
  ON public.pincode_directory
  FOR SELECT
  TO anon, authenticated
  USING (true);
