import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS HEADERS
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

const isString = (value: any): value is string => typeof value === 'string';

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
    // Service role key needed for INSERT operations on states/cities/localities
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { pincode } = body;

    if (!isString(pincode) || !/^\d{6}$/.test(pincode)) {
      return new Response(JSON.stringify({ error: 'Invalid pincode format (must be 6 digits).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // ─── TIER 1: Check DB ───
    const { data, error: dbError } = await supabase
      .from('localities')
      .select(`
        id, city_id, pincode, names, latitude, longitude,
        city:cities (
          id, names, state_id,
          state:states (id)
        )
      `)
      .eq('pincode', pincode)
      .limit(1)
      .maybeSingle();

    if (dbError) throw dbError;

    if (data?.city?.state) {
      // Found in DB — return structured result
      return new Response(JSON.stringify({
        locality: {
          id: data.id, city_id: data.city_id, pincode: data.pincode,
          names: data.names, latitude: data.latitude, longitude: data.longitude
        },
        city: { id: data.city.id, names: data.city.names, state_id: data.city.state_id },
        stateId: data.city.state.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── TIER 2: Not in DB — resolve via Nominatim ───
    // Step 1: Postalcode search for coords, city, state
    const searchUrl = `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&addressdetails=1&limit=1&accept-language=en`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const searchRes = await fetch(searchUrl, { headers: NOMINATIM_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    const searchResults = await searchRes.json();

    if (!searchResults?.[0]?.address) {
      return new Response(JSON.stringify({ message: 'Pincode not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const addr = searchResults[0].address;
    const lat = parseFloat(searchResults[0].lat);
    const lon = parseFloat(searchResults[0].lon);

    let localityName = addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || '';
    const cityName = addr.city || addr.town || addr.county || addr.state_district || '';
    const stateName = addr.state || '';

    if (!cityName || !stateName) {
      return new Response(JSON.stringify({ message: 'Could not resolve city/state for pincode.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Step 2: If locality still empty, try reverse-geocode with coords (more precise)
    if (!localityName && lat && lon) {
      try {
        const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=en&zoom=16`;
        // Brief pause to respect Nominatim's 1 req/sec policy
        await new Promise(r => setTimeout(r, 1100));
        const revRes = await fetch(revUrl, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(8000) });
        const revData = await revRes.json();
        if (revData?.address) {
          localityName = revData.address.suburb || revData.address.neighbourhood ||
                         revData.address.village || revData.address.hamlet || '';
        }
      } catch (e) {
        console.warn(`[lookup-pincode] Reverse geocode for locality failed:`, e);
      }
    }

    // Use city name as locality fallback if still empty
    if (!localityName) {
      localityName = cityName;
    }

    // ─── TIER 3: Find-or-create DB records ───

    // Find or create STATE
    let stateId: number;
    const { data: existingState } = await supabase
      .from('states')
      .select('id')
      .ilike('names->>en', stateName)
      .maybeSingle();

    if (existingState) {
      stateId = existingState.id;
    } else {
      const { data: newState, error: stateErr } = await supabase
        .from('states')
        .insert({ names: { en: stateName } })
        .select('id')
        .single();
      if (stateErr) throw stateErr;
      stateId = newState.id;
      console.log(`[lookup-pincode] Created new state: ${stateName} (id: ${stateId})`);
    }

    // Find or create CITY
    let cityId: number;
    const { data: existingCity } = await supabase
      .from('cities')
      .select('id')
      .ilike('names->>en', cityName)
      .eq('state_id', stateId)
      .maybeSingle();

    if (existingCity) {
      cityId = existingCity.id;
    } else {
      const { data: newCity, error: cityErr } = await supabase
        .from('cities')
        .insert({ names: { en: cityName }, state_id: stateId })
        .select('id')
        .single();
      if (cityErr) throw cityErr;
      cityId = newCity.id;
      console.log(`[lookup-pincode] Created new city: ${cityName} (id: ${cityId}, state: ${stateName})`);
    }

    // Create LOCALITY
    const { data: newLocality, error: locErr } = await supabase
      .from('localities')
      .insert({
        pincode,
        names: { en: localityName },
        city_id: cityId,
        latitude: lat,
        longitude: lon,
      })
      .select('id, city_id, pincode, names, latitude, longitude')
      .single();

    if (locErr) throw locErr;
    console.log(`[lookup-pincode] Created new locality: ${localityName} (pincode: ${pincode}, city: ${cityName}, state: ${stateName})`);

    return new Response(JSON.stringify({
      locality: newLocality,
      city: { id: cityId, names: { en: cityName }, state_id: stateId },
      stateId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Pincode Lookup Error:', error.message);

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
