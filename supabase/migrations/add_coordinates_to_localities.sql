-- Add latitude and longitude columns to localities table for server-side geocoding cache.
-- This eliminates client-side Nominatim calls and enables DB-first coordinate lookups.

ALTER TABLE public.localities
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Index for fast "has coordinates?" checks and spatial filtering
CREATE INDEX IF NOT EXISTS idx_localities_coords
  ON public.localities (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Also create a geocode_cache table for address-level geocoding results
-- (for free-form address queries that don't map to a specific locality row)
CREATE TABLE IF NOT EXISTS public.geocode_cache (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  query_key text NOT NULL UNIQUE,        -- normalized query string or "reverse:{lat},{lng}"
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  city text,
  state text,
  locality text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '90 days'
);

CREATE INDEX IF NOT EXISTS idx_geocode_cache_key ON public.geocode_cache (query_key);
CREATE INDEX IF NOT EXISTS idx_geocode_cache_expires ON public.geocode_cache (expires_at);

-- RLS: public read on geocode_cache (same as localities)
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read geocode_cache" ON public.geocode_cache FOR SELECT USING (true);
-- Only service_role can insert/update (Edge Functions use service role key)
CREATE POLICY "Service insert geocode_cache" ON public.geocode_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update geocode_cache" ON public.geocode_cache FOR UPDATE USING (true);
