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
 * geocode-address: Resolves a free-form address string to latitude/longitude.
 *
 * Strategy:
 *   1. Normalize the query and check geocode_cache
 *   2. Call Nominatim free-form search, cache the result
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
    const { address } = body;

    if (typeof address !== 'string' || address.trim().length < 3) {
      return new Response(JSON.stringify({ error: 'Address must be at least 3 characters.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Normalize for cache key: lowercase, collapse whitespace, trim
    const normalizedAddress = address.trim().toLowerCase().replace(/\s+/g, ' ');
    const cacheKey = `addr:${normalizedAddress}`;

    // TIER 1: Check geocode_cache
    const { data: cached } = await supabase
      .from('geocode_cache')
      .select('latitude, longitude')
      .eq('query_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached?.latitude && cached?.longitude) {
      console.log(`[geocode-address] Cache hit for "${normalizedAddress}"`);
      return new Response(JSON.stringify({ latitude: cached.latitude, longitude: cached.longitude, source: 'cache' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TIER 2: Nominatim free-form query
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address.trim())}&format=json&limit=1&accept-language=en`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    const results = await res.json();

    if (!results || !results[0]) {
      console.warn(`[geocode-address] Nominatim found no results for "${address}"`);
      return new Response(JSON.stringify({ error: 'Could not geocode address.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const latitude = parseFloat(results[0].lat);
    const longitude = parseFloat(results[0].lon);
    console.log(`[geocode-address] Nominatim resolved "${address}" → ${latitude}, ${longitude}`);

    // Cache the result
    supabase
      .from('geocode_cache')
      .upsert({ query_key: cacheKey, latitude, longitude }, { onConflict: 'query_key' })
      .then(({ error }) => {
        if (error) console.error('[geocode-address] Cache write failed:', error.message);
      });

    return new Response(JSON.stringify({ latitude, longitude, source: 'nominatim' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[geocode-address] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
