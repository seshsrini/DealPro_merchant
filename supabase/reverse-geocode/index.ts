import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const NOMINATIM_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'DealProServer/1.0',
  'Accept-Language': 'en',
}

/**
 * reverse-geocode: Resolves latitude/longitude to city, state, and locality.
 *
 * Strategy:
 *   1. Round coords to ~1km precision and check geocode_cache
 *   2. Call Nominatim reverse geocoding, cache the result
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { latitude, longitude } = body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return new Response(JSON.stringify({ error: 'Invalid coordinates.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Round to ~110m precision for cache key (3 decimal places)
    const roundedLat = Math.round(latitude * 1000) / 1000;
    const roundedLng = Math.round(longitude * 1000) / 1000;
    const cacheKey = `reverse:${roundedLat},${roundedLng}`;

    // TIER 1: Check geocode_cache
    const { data: cached } = await supabase
      .from('geocode_cache')
      .select('city, state, locality')
      .eq('query_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached?.city) {
      console.log(`[reverse-geocode] Cache hit for ${roundedLat}, ${roundedLng}`);
      return new Response(JSON.stringify({ city: cached.city, state: cached.state, locality: cached.locality, source: 'cache' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TIER 2: Nominatim reverse geocoding
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=en`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();

    if (!data || !data.address) {
      console.warn(`[reverse-geocode] Nominatim returned no results for ${latitude}, ${longitude}`);
      return new Response(JSON.stringify({ error: 'Could not reverse geocode coordinates.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const addr = data.address;
    const city = addr.city || addr.town || addr.county || '';
    const state = addr.state || '';
    const locality = addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || '';
    console.log(`[reverse-geocode] Nominatim resolved ${latitude}, ${longitude} → ${city}, ${state}`);

    if (!city) {
      return new Response(JSON.stringify({ error: 'Could not determine city from coordinates.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Cache the result
    supabase
      .from('geocode_cache')
      .upsert(
        { query_key: cacheKey, latitude: roundedLat, longitude: roundedLng, city, state, locality },
        { onConflict: 'query_key' }
      )
      .then(({ error }) => {
        if (error) console.error('[reverse-geocode] Cache write failed:', error.message);
      });

    return new Response(JSON.stringify({ city, state, locality, source: 'nominatim' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[reverse-geocode] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
