if (req.method === 'OPTIONS') {

return new Response('ok', { headers: corsHeaders });

}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. GLOBAL CORS HEADERS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Validation Helpers
export const isString = (value: any): value is string => typeof value === 'string';

// Authenticate helper with CORS awareness
export async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not set.');
  }

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new Error('Unauthorized: Invalid or expired token.');
  return user;
}

Deno.serve(async (req) => {
  // 2. HANDLE CORS PREFLIGHT
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
    // 3. AUTHENTICATION
    await authenticateRequest(req);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    const body = await req.json();
    const { pincode } = body;

    // 4. VALIDATION
    if (!isString(pincode) || !/^\d{6}$/.test(pincode)) {
      return new Response(JSON.stringify({ error: 'Invalid pincode format (must be 6 digits).' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    // 5. DATABASE QUERY (Using joins to fetch related City and State)
    const { data, error: dbError } = await supabase
      .from('localities')
      .select(`
        id, city_id, pincode, names,
        city:cities (
          id, names, state_id,
          state:states (id)
        )
      `)
      .eq('pincode', pincode)
      .limit(1)
      .maybeSingle();

    if (dbError) throw dbError;

    // 6. RESPONSE MAPPING
    if (!data || !data.city || !data.city.state) {
      return new Response(JSON.stringify({ message: 'Pincode not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const result = {
      locality: {
        id: data.id,
        city_id: data.city_id,
        pincode: data.pincode,
        names: data.names
      },
      city: {
        id: data.city.id,
        names: data.city.names,
        state_id: data.city.state_id
      },
      stateId: data.city.state.id
    };

    // 7. SUCCESS RESPONSE
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Pincode Lookup Error:', error.message);
    
    let status = 500;
    if (error.message.includes('Unauthorized')) status = 401;

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});