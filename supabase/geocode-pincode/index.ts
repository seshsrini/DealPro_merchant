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
 * geocode-pincode: Resolves a 6-digit Indian pincode to latitude/longitude.
 *
 * Strategy (3-tier fallback):
 *   1. Check localities table for cached coordinates
 *   2. Check geocode_cache table
 *   3. Call Nominatim, then write result back to both tables
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

    // Use service role for DB writes (caching geocode results)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { pincode } = body;

    if (typeof pincode !== 'string' || !/^\d{6}$/.test(pincode)) {
      return new Response(JSON.stringify({ error: 'Invalid pincode (must be 6 digits).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // TIER 1: Check localities table for pre-cached coordinates
    const { data: locality } = await supabase
      .from('localities')
      .select('latitude, longitude')
      .eq('pincode', pincode)
      .not('latitude', 'is', null)
      .limit(1)
      .maybeSingle();

    if (locality?.latitude && locality?.longitude) {
      console.log(`[geocode-pincode] DB hit for ${pincode}`);
      return new Response(JSON.stringify({ latitude: locality.latitude, longitude: locality.longitude, source: 'db' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TIER 2: Check geocode_cache table
    const cacheKey = `pincode:${pincode}`;
    const { data: cached } = await supabase
      .from('geocode_cache')
      .select('latitude, longitude')
      .eq('query_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cached?.latitude && cached?.longitude) {
      console.log(`[geocode-pincode] Cache hit for ${pincode}`);
      return new Response(JSON.stringify({ latitude: cached.latitude, longitude: cached.longitude, source: 'cache' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // TIER 3: Nominatim structured query
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1&accept-language=en`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    const results = await res.json();

    if (!results || !results[0]) {
      console.warn(`[geocode-pincode] Nominatim found no results for ${pincode}`);
      return new Response(JSON.stringify({ error: 'Could not geocode pincode.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const latitude = parseFloat(results[0].lat);
    const longitude = parseFloat(results[0].lon);
    console.log(`[geocode-pincode] Nominatim resolved ${pincode} → ${latitude}, ${longitude}`);

    // Write back to localities table (all rows with this pincode)
    supabase
      .from('localities')
      .update({ latitude, longitude })
      .eq('pincode', pincode)
      .is('latitude', null)
      .then(({ error }) => {
        if (error) console.error('[geocode-pincode] Failed to update localities:', error.message);
        else console.log(`[geocode-pincode] Cached coords in localities for ${pincode}`);
      });

    // Write to geocode_cache
    supabase
      .from('geocode_cache')
      .upsert({ query_key: cacheKey, latitude, longitude }, { onConflict: 'query_key' })
      .then(({ error }) => {
        if (error) console.error('[geocode-pincode] Failed to update geocode_cache:', error.message);
      });

    return new Response(JSON.stringify({ latitude, longitude, source: 'nominatim' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[geocode-pincode] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
