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
export const isObject = (value: any): boolean => typeof value === 'object' && value !== null && !Array.isArray(value);

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
    const user = await authenticateRequest(req);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    const body = await req.json();
    const { user_id, event_type, merchant_id, campaign_id, platform, metadata } = body;

    // 4. VALIDATION
    if (!isString(user_id) || user_id !== user.id) {
       return new Response(JSON.stringify({ error: "Unauthorized: User ID mismatch." }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403 
      });
    }

    if (!isString(event_type) || !isString(platform)) {
      return new Response(JSON.stringify({ error: 'Missing required fields: event_type or platform.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    // 5. DATA INSERTION
    const { error: dbError } = await supabase.from('user_activity_logs').insert([{
      user_id,
      event_type,
      merchant_id: merchant_id || null,
      campaign_id: campaign_id || null,
      platform,
      metadata: metadata || {},
    }]);

    if (dbError) throw dbError;

    // 6. SUCCESS RESPONSE
    return new Response(JSON.stringify({ message: 'Activity logged successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });

  } catch (error: any) {
    console.error('Logger Error:', error.message);
    
    let status = 500;
    if (error.message.includes('Unauthorized')) status = 401;

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});