import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 2. Verify the caller is authenticated using their JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized: No access token provided.');
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      // Distinguish expired from malformed so the client can react (force refresh + retry).
      const reason = /jwt expired|expired/i.test(authError?.message || '') ? 'expired' : 'invalid';
      throw new Error(`Unauthorized: token ${reason}`);
    }

    // 3. Use service role to read activity logs (consumer rows aren't visible
    //    to the merchant via RLS — merchants need to see clicks on their campaigns)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Parse Body (expecting campaignIds)
    const { campaignIds } = await req.json();
    console.log('[GetCampaignSpecificClicks] Fetching clicks for', Array.isArray(campaignIds) ? campaignIds.length : 0, 'campaigns');

    if (!Array.isArray(campaignIds)) {
       return new Response(JSON.stringify({ error: 'campaignIds must be an array' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 400,
       });
    }

    // 5. Query activity logs — fetch both views and claim clicks in one query
    const { data: logs, error: dbError } = await supabase
      .from('user_activity_logs')
      .select('campaign_id, event_type')
      .in('event_type', ['view_deal', 'click', 'claim_click'])
      .in('campaign_id', campaignIds);

    if (dbError) {
      console.error('[GetCampaignSpecificClicks] Query failed:', dbError.message);
      throw dbError;
    }

    // 6. Aggregate: views and claim_clicks separately
    const views: Record<string, number> = {};
    const claimClicks: Record<string, number> = {};
    campaignIds.forEach(id => { views[id] = 0; claimClicks[id] = 0; });
    (logs || []).forEach(log => {
      if (!log.campaign_id) return;
      if (log.event_type === 'claim_click') {
        claimClicks[log.campaign_id] = (claimClicks[log.campaign_id] || 0) + 1;
      } else {
        views[log.campaign_id] = (views[log.campaign_id] || 0) + 1;
      }
    });

    console.log('[GetCampaignSpecificClicks] Returned counts for', Object.keys(views).length, 'campaigns');

    // Return both sets — legacy `counts` key kept for backward compat (= views).
    // New consumers should read `views` and `claimClicks`.
    return new Response(JSON.stringify({ counts: views, views, claimClicks }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    const isAuth = error?.message?.includes('Unauthorized');
    // Auth failures are expected user behavior (expired token, signed out elsewhere) —
    // log as warn so they don't pollute the error dashboard.
    if (isAuth) {
      console.warn('[GetCampaignSpecificClicks] Auth rejected:', error.message);
    } else {
      console.error('[GetCampaignSpecificClicks] Error:', error.message);
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: isAuth ? 401 : 400,
    });
  }
});