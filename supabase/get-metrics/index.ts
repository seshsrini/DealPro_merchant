// @ts-ignore: Deno is a global in Deno runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// --- Validation Helpers ---
export const isString = (value: any): value is string => typeof value === 'string';

// --- Improved Authenticate Request ---
export async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) throw new Error('Unauthorized: No access token provided.');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(jwt);

  if (error || !user) throw new Error('Unauthorized: Invalid or expired token.');
  return user;
}

// --- CORS Configuration ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  // 1. MUST handle OPTIONS with explicit 200 status
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 2. Validate User
    const user = await authenticateRequest(req);

    // 3. Parse Body
    const { merchantId, activeRoiTab } = await req.json();

    // 4. Validation & Authorization
    if (!isString(merchantId) || merchantId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Merchant ID mismatch.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 403 
      });
    }

    if (!isString(activeRoiTab) || !['review', 'active', 'expired'].includes(activeRoiTab)) {
       return new Response(JSON.stringify({ error: 'Invalid active ROI tab.' }), { 
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
         status: 400 
      });
    }

    // 5. Database Client (Using Service Role to ensure metrics are visible regardless of RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch total campaigns
    const { data: campaigns, count: campaignCount, error: campaignError } = await supabase
      .from('campaigns')
      .select('campaign_id', { count: 'exact' })
      .eq('merchant_id', merchantId)
      .eq('status', activeRoiTab);

    if (campaignError) throw campaignError;

    const campaignIds = campaigns ? campaigns.map(c => c.campaign_id) : [];

    // Fetch total redemptions
    let totalRedemptions = 0;
    if (campaignIds.length > 0) {
      const { count: redeemedCount, error: redemptionError } = await supabase
        .from('campaign_interactions')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .eq('is_redeemed', true)
        .in('campaign_id', campaignIds);

      if (redemptionError) throw redemptionError;
      totalRedemptions = redeemedCount || 0;
    }

    // Fetch total clicks
    let totalClicks = 0;
    if (campaignIds.length > 0) {
      const { count: clicksCount, error: clicksError } = await supabase
        .from('user_activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'click')
        .in('campaign_id', campaignIds);

      if (clicksError) throw clicksError;
      totalClicks = clicksCount || 0;
    }
    
    // Fetch Total Reach
    const { count: viewsCount, error: viewsError } = await supabase
      .from('user_activity_logs')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('event_type', 'view')
      .not('campaign_id', 'is', null);

    if (viewsError) throw viewsError;
    const totalReach = viewsCount || 0;

    const result = {
      totalCampaigns: campaignCount || 0,
      totalRedemptions: totalRedemptions,
      totalReach: totalReach.toLocaleString(),
      conversionRate: totalReach > 0 ? `${((totalRedemptions / totalReach) * 100).toFixed(1)}%` : '0%',
      totalClicks,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Dashboard Metrics Error]:', error.message);
    const status = error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});