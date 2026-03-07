import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. GLOBAL CORS HEADERS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Validation Helpers
export const isString = (value: any): value is string => typeof value === 'string';
export const isArray = (value: any): value is any[] => Array.isArray(value);

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
  // 2. HANDLE CORS PREFLIGHT (Must be INSIDE Deno.serve)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 3. ENFORCE POST METHOD
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    // 4. AUTHENTICATION
    const user = await authenticateRequest(req);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    // Safe JSON parsing
    const body = await req.json().catch(() => ({}));
    const { campaignIds, merchantId } = body;
    console.log('[GetCampaignRedemptions] Fetching for merchant:', merchantId, 'campaigns:', campaignIds?.length ?? 0);

    // 5. VALIDATION
    if (!isArray(campaignIds) || !campaignIds.every(isString)) {
      throw new Error('Campaign IDs must be an array of strings.');
    }
    if (!isString(merchantId) || merchantId.length < 1) {
      throw new Error('Merchant ID is required.');
    }

    // Authorization check
    if (merchantId !== user.id) {
       return new Response(JSON.stringify({ error: 'Unauthorized: Merchant mismatch.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403 
      });
    }

    if (campaignIds.length === 0) {
      return new Response(JSON.stringify({}), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      });
    }

    // 6. DATABASE QUERY
    const { data: redemptionLogs, error: logError } = await supabase
      .from('campaign_interactions')
      .select('campaign_id')
      .eq('merchant_id', merchantId)
      .eq('is_redeemed', true)
      .in('campaign_id', campaignIds);

    if (logError) { console.error('[GetCampaignRedemptions] Query failed:', logError.message); throw logError; }

    // 7. PROCESSING
    const counts: Record<string, number> = {};
    for (const id of campaignIds) {
        counts[id] = 0; 
    }
    (redemptionLogs || []).forEach(log => {
        if (log.campaign_id) {
            counts[log.campaign_id] = (counts[log.campaign_id] || 0) + 1;
        }
    });

    // 8. SUCCESS RESPONSE
    return new Response(JSON.stringify(counts), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Redemptions Fetch Error:', error.message);
    
    let status = 500;
    if (error.message.includes('Unauthorized')) status = 401;
    if (error.message.includes('array') || error.message.includes('required')) status = 400;

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});