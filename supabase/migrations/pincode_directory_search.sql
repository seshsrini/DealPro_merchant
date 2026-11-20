-- Pincode directory: spelling-tolerant area search + owner admin stats.
-- Run on DEV and PROD (safe to re-run). Adds functions only; no data changes.
--
-- Why: India Post spells areas its own way ("Jeevanbheemanagar", "Indira Nagar",
-- "Hal Ii Stage"), so a plain ILIKE misses what people actually type
-- ("Jeevan Bhima Nagar", "Indiranagar"). dir_norm() reduces both sides to a
-- loose phonetic key: lower-case letters/digits only, long vowels shortened
-- (ee→i, oo→u, aa→a), w→v, y→i, aspirates dropped (bh→b, th→t, sh→s …) and
-- repeated letters collapsed. "Jeevan Bhima Nagar" and "Jeevanbheemanagar"
-- both become "jivanbimanagar".

CREATE OR REPLACE FUNCTION public.dir_norm(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT regexp_replace(
           regexp_replace(
             replace(replace(replace(replace(replace(
               regexp_replace(lower(coalesce(s, '')), '[^a-z0-9]', '', 'g'),
               'ee', 'i'), 'oo', 'u'), 'aa', 'a'), 'w', 'v'), 'y', 'i'),
             '([bcdgjkpst])h', '\1', 'g'),
           '(.)\1+', '\1', 'g');
$$;

-- Fast "contains" matching on the normalised name (pg_trgm is installed).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_pincode_directory_norm_trgm
  ON public.pincode_directory USING gin (public.dir_norm(locality) gin_trgm_ops);

-- Consumer app area search. Scoped to a city by its pincode prefix (560 =
-- Bengaluru) when known, else by city/district name; unscoped when neither.
-- One row per (pincode, area). Ranking: name starts with the query, then
-- contains it, then close typos ("kormangala" → Koramangala; within a city
-- only, where the candidate set is a few hundred rows).
CREATE OR REPLACE FUNCTION public.search_pincode_directory(
  q text,
  pin_prefix text DEFAULT NULL,
  city_name text DEFAULT NULL,
  max_rows int DEFAULT 30
)
RETURNS TABLE (pincode text, locality text, city text, state text)
LANGUAGE sql
STABLE
AS $$
  WITH n AS (SELECT public.dir_norm(q) AS nq, trim(coalesce(q, '')) AS raw),
  scoped AS (
    SELECT d.*, public.dir_norm(d.locality) AS dn
    FROM public.pincode_directory d, n
    WHERE length(n.nq) >= 2
      AND (pin_prefix IS NULL OR pin_prefix = '' OR d.pincode LIKE pin_prefix || '%')
      AND (coalesce(pin_prefix, '') <> '' OR coalesce(city_name, '') = ''
           OR d.city ILIKE '%' || city_name || '%' OR d.district ILIKE '%' || city_name || '%')
  ),
  hits AS (
    SELECT DISTINCT ON (s.pincode, lower(s.locality))
           s.pincode, s.locality, s.city, s.state,
           (s.dn LIKE n.nq || '%') AS starts,
           (s.dn LIKE '%' || n.nq || '%' OR s.locality ILIKE '%' || n.raw || '%') AS contains,
           word_similarity(n.nq, s.dn) AS sim
    FROM scoped s, n
    WHERE s.dn LIKE '%' || n.nq || '%'
       OR s.locality ILIKE '%' || n.raw || '%'
       OR (coalesce(pin_prefix, '') <> '' AND length(n.nq) >= 5 AND word_similarity(n.nq, s.dn) >= 0.57)
    ORDER BY s.pincode, lower(s.locality), (s.source = 'india_post') DESC
  )
  SELECT h.pincode, h.locality, h.city, h.state
  FROM hits h
  ORDER BY h.starts DESC, h.contains DESC, h.sim DESC, h.locality, h.pincode
  LIMIT greatest(1, least(coalesce(max_rows, 30), 100));
$$;

GRANT EXECUTE ON FUNCTION public.dir_norm(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_pincode_directory(text, text, text, int) TO anon, authenticated, service_role;

-- Owner admin page (vedicjaalam.com/admin → DealFynd Pincodes): totals per
-- state and per source. Called with the service-role key only.
CREATE OR REPLACE FUNCTION public.pincode_directory_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'rows',      (SELECT count(*) FROM public.pincode_directory),
    'pincodes',  (SELECT count(DISTINCT pincode) FROM public.pincode_directory),
    'by_source', (SELECT coalesce(jsonb_object_agg(src, c), '{}'::jsonb)
                  FROM (SELECT coalesce(source, 'india_post') AS src, count(*) AS c
                        FROM public.pincode_directory GROUP BY 1) s),
    'states',    (SELECT coalesce(jsonb_agg(jsonb_build_object('state', st, 'rows', c) ORDER BY st), '[]'::jsonb)
                  FROM (SELECT coalesce(nullif(trim(state), ''), '(none)') AS st, count(*) AS c
                        FROM public.pincode_directory GROUP BY 1) s)
  );
$$;

REVOKE ALL ON FUNCTION public.pincode_directory_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pincode_directory_stats() TO service_role;
