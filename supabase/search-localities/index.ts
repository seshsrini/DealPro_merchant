if (req.method === 'OPTIONS') {

return new Response('ok', { headers: corsHeaders });

}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. GLOBAL CORS HEADERS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { query, lang = 'en' } = body;

    // 4. VALIDATION
    if (!isString(query) || query.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Search query must be at least 2 characters.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    // 5. SEARCH LOGIC
    const searchPattern = `%${query.trim()}%`;
    const pincodePattern = `${query.trim()}%`; // Pincodes usually search by prefix
    const langs = ['en', 'hi', 'kn', 'ta', 'te', 'ml', 'bn', 'mr', 'gu'];
    
    // Construct dynamic OR filters for Pincode and multilingual name fields
    const orFilters = [
      `pincode.ilike.${pincodePattern}`, 
      ...langs.map(l => `names->>${l}.ilike.${searchPattern}`)
    ].join(',');

    const { data, error: dbError } = await supabase
      .from('localities')
      .select('id, city_id, pincode, names')
      .or(orFilters)
      .order('pincode', { ascending: true })
      .limit(20);
    
    if (dbError) throw dbError;

    // 6. RESPONSE MAPPING
    // Injects a 'display_name' based on the requested language or English fallback
    const localities = (data || []).map((loc: any) => ({
      ...loc,
      display_name: loc.names[lang] || loc.names['en'] || loc.pincode
    }));

    return new Response(JSON.stringify(localities), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Locality Search Error:', error.message);
    
    let status = 500;
    if (error.message.includes('Unauthorized')) status = 401;

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});