// @ts-ignore: Deno is a global in Deno runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// --- HELPER: Authenticate User ---
async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) throw new Error('Unauthorized: No access token provided.');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new Error('Unauthorized: Invalid token.');
  return { user, jwt };
}

// --- MAIN FUNCTION ---
Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use Service Role to bypass RLS for role checks

  try {
    // 2. Authenticate
    const { user, jwt } = await authenticateRequest(req);
    const { merchantId } = await req.json();

    console.log(`[get-stores] Request for Merchant: ${merchantId} by User: ${user.id}`);

    // 3. Security Check: Payload ID must match Token ID
    if (merchantId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: ID Mismatch' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 403 
      });
    }

    // 4. Create Admin Client to verify role (bypasses RLS to see if profile exists)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle(); // This fix prevents the "Coerce to JSON" error

    if (profileError) throw new Error(`DB Error: ${profileError.message}`);
    
    if (!userProfile) {
      console.error(`[get-stores] Profile row missing in user_profiles for UUID: ${user.id}`);
      return new Response(JSON.stringify({ error: 'Merchant profile row does not exist.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 404 
      });
    }

    if (userProfile.role !== 'merchant') {
      return new Response(JSON.stringify({ error: 'Unauthorized: Not a merchant account.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 403 
      });
    }

    // 5. Fetch Stores using the USER'S JWT (Respects RLS on the stores table)
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: `Bearer ${jwt}` } }
    });

    const { data: stores, error: storeError } = await supabaseUser
      .from('merchant_stores')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('id', { ascending: true });

    if (storeError) throw storeError;

    return new Response(JSON.stringify(stores || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[get-stores] Final Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message.includes('Unauthorized') ? 401 : 500,
    });
  }
});