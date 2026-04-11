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

// --- HELPER: Authenticate User (uses service role for reliable token verification) ---
async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) throw new Error('Unauthorized: No access token provided.');

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error } = await admin.auth.getUser(jwt);
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
    const body = await req.json();

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Resolve effective merchant ID — supports owners and staff members
    let effectiveMerchantId = body.merchantId || user.id;

    // Check merchant_staff to find the real merchant ID
    const { data: staffRows } = await supabaseAdmin
      .from('merchant_staff')
      .select('merchant_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (staffRows && staffRows.length > 0) {
      const staffEntry = staffRows.find(r => r.merchant_id !== user.id) || staffRows[0];
      effectiveMerchantId = staffEntry.merchant_id;
    }

    // Verify the resolved merchant exists
    const { data: merchantProfile } = await supabaseAdmin
      .from('merchant_profiles')
      .select('role')
      .eq('id', effectiveMerchantId)
      .maybeSingle();

    if (!merchantProfile || merchantProfile.role !== 'merchant') {
      console.error(`[get-stores] No valid merchant profile for ID: ${effectiveMerchantId} (userId: ${user.id})`);
      return new Response(JSON.stringify({ error: 'Merchant profile not found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    console.log(`[get-stores] Fetching stores for merchant: ${effectiveMerchantId} (userId: ${user.id})`);

    // 4. Fetch Stores using admin client (service role bypasses RLS)
    const { data: stores, error: storeError } = await supabaseAdmin
      .from('merchant_stores')
      .select('*')
      .eq('merchant_id', effectiveMerchantId)
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