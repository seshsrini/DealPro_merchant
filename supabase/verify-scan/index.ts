
// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. GLOBAL CORS HEADERS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Validation Helpers
export const isString = (value: any): value is string => typeof value === 'string';
export const isObject = (value: any): value is object => typeof value === 'object' && value !== null;

// Authenticate helper with CORS awareness
export async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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
    // 3. AUTHENTICATION & INITIALIZATION
    const user = await authenticateRequest(req);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    // Robust staff lockout: block a suspended/removed staff member even with a
    // still-valid session. merchant_is_active_actor returns false only when the
    // user has staff rows but none active. Fail-open on null (RPC not deployed /
    // transient) so legitimate merchants are never blocked by a glitch.
    const { data: __actorOk } = await supabase.rpc('merchant_is_active_actor', { p_user_id: user.id });
    if (__actorOk === false) {
      return new Response(JSON.stringify({ success: false, error: 'ACCESS_DISABLED', message: 'Your access has been disabled by the store owner.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
      });
    }

    const { claimData, merchantId } = await req.json();
    console.log('[VerifyScan] Merchant:', merchantId, 'scanning claim');

    // 4. AUTHORIZATION: Ensure the merchant is who they say they are
    if (!isString(merchantId) || merchantId !== user.id) {
      return new Response(JSON.stringify({ success: false, message: 'Unauthorized: Merchant ID mismatch.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403 
      });
    }

    // 5. PARSE SCAN DATA
    let claimNo: string;
    let consumerId: string | undefined;

    if (isObject(claimData) && isString(claimData.claim_no)) {
      claimNo = claimData.claim_no.toUpperCase();
      consumerId = claimData.consumer_id;
    } else if (isString(claimData)) {
      claimNo = claimData.toUpperCase();
    } else {
      return new Response(JSON.stringify({ success: false, message: 'Invalid scan data format.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    // 6. REDEMPTION LOGIC
    // Retrieve the interaction specifically for THIS merchant
    const { data: interaction, error: fetchError } = await supabase
      .from('campaign_interactions')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('claim_no', claimNo)
      .maybeSingle();

    if (fetchError) throw fetchError;

    // VALIDATION CHECKS
    if (!interaction) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid Voucher', error: 'INVALID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 // Bad Request - voucher not found for this merchant
      });
    }

    if (consumerId && interaction.consumer_id !== consumerId) {
      return new Response(JSON.stringify({ success: false, message: 'Voucher belongs to a different consumer.', error: 'INVALID_CONSUMER' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    if (interaction.is_redeemed) {
      return new Response(JSON.stringify({ success: false, message: 'Voucher Already Redeemed', error: 'REDEEMED' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409 
      });
    }

    // 7. EXECUTE REDEMPTION
    const { error: updateError } = await supabase
      .from('campaign_interactions')
      .update({ 
        is_redeemed: true, 
        redeemed_at: new Date().toISOString() 
      })
      .eq('interaction_id', interaction.interaction_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, message: 'Voucher successfully redeemed.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Redemption Error:', error.message);
    const status = error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
});