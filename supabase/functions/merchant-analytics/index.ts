// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No token provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // 2. Verify user is a merchant
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || userProfile?.role !== 'merchant') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Merchant access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { period = '30' } = body; // Default to 30 days

    const isLifetime = period === 'lifetime';
    const periodDays = isLifetime ? 0 : parseInt(period);
    const startDate = new Date();
    if (!isLifetime) {
      startDate.setDate(startDate.getDate() - periodDays);
    }
    const startDateStr = isLifetime ? 'lifetime' : startDate.toISOString().split('T')[0];

    console.log('[merchant-analytics] Fetching analytics for merchant:', user.id, 'period:', isLifetime ? 'lifetime' : `${periodDays} days`, 'starting from:', startDateStr);

    // 3. Get total campaigns count for this merchant (created in the selected period or all time)
    let totalCampaignsQuery = supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', user.id);

    if (!isLifetime) {
      totalCampaignsQuery = totalCampaignsQuery.gte('created_at', startDate.toISOString());
    }

    const { count: totalCampaigns, error: totalError } = await totalCampaignsQuery;

    if (totalError) {
      console.error('[merchant-analytics] Error fetching total campaigns:', totalError);
      throw totalError;
    }

    // 4. Get active campaigns count for this merchant (status = 'active' and end_date >= today or end_date is null)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison

    let activeCampaignsQuery = supabaseAdmin
      .from('campaigns')
      .select('end_date, status')
      .eq('merchant_id', user.id)
      .eq('status', 'active');

    if (!isLifetime) {
      activeCampaignsQuery = activeCampaignsQuery.gte('created_at', startDate.toISOString());
    }

    const { data: activeCampaignsData, error: activeError } = await activeCampaignsQuery;

    if (activeError) {
      console.error('[merchant-analytics] Error fetching active campaigns:', activeError);
      throw activeError;
    }

    // Filter for truly active ones (end_date >= today or null)
    const activeCampaigns = activeCampaignsData?.filter(c => {
      if (!c.end_date) return true; // No end date = always active

      const endDate = new Date(c.end_date);
      endDate.setHours(0, 0, 0, 0); // Set to start of day for comparison

      return endDate >= today; // end_date in the future or today
    }).length || 0;

    console.log('[merchant-analytics] Active campaigns:', activeCampaigns, 'out of', activeCampaignsData?.length || 0, 'with status=active');

    // 5. Get total stores count for this merchant
    const { count: totalStores, error: storesError } = await supabaseAdmin
      .from('merchant_stores')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', user.id);

    if (storesError) {
      console.error('[merchant-analytics] Error fetching stores:', storesError);
      throw storesError;
    }

    // 6. Get campaign creation trend for this merchant (last N days, or last 90 days for lifetime)
    const trendData: Record<string, number> = {};
    const trendPeriodDays = isLifetime ? 90 : periodDays; // Show last 90 days for lifetime
    const trendStartDate = new Date();
    trendStartDate.setDate(trendStartDate.getDate() - trendPeriodDays);

    // Initialize all dates with 0
    for (let i = 0; i < trendPeriodDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trendData[dateStr] = 0;
    }

    // Fetch campaigns created in the trend period
    const { data: trendCampaigns, error: trendError } = await supabaseAdmin
      .from('campaigns')
      .select('created_at')
      .eq('merchant_id', user.id)
      .gte('created_at', trendStartDate.toISOString());

    if (trendError) {
      console.error('[merchant-analytics] Error fetching trend data:', trendError);
      throw trendError;
    }

    // Count campaigns per day
    trendCampaigns?.forEach(campaign => {
      const dateStr = campaign.created_at.split('T')[0];
      if (trendData[dateStr] !== undefined) {
        trendData[dateStr]++;
      }
    });

    const campaignTrend = Object.entries(trendData)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 7. Get status breakdown for this merchant's campaigns (campaigns created in the selected period or all time)
    let statusQuery = supabaseAdmin
      .from('campaigns')
      .select('status')
      .eq('merchant_id', user.id);

    if (!isLifetime) {
      statusQuery = statusQuery.gte('created_at', startDate.toISOString());
    }

    const { data: statusData, error: statusError } = await statusQuery;

    if (statusError) {
      console.error('[merchant-analytics] Error fetching status data:', statusError);
      throw statusError;
    }

    const statusBreakdown = {
      approved: 0,
      review: 0,
      needs_review: 0,
      expired: 0
    };

    statusData?.forEach(campaign => {
      const status = campaign.status?.toLowerCase();
      if (status === 'active') {
        statusBreakdown.approved++;
      } else if (status === 'review') {
        statusBreakdown.review++;
      } else if (status === 'needs review') {
        statusBreakdown.needs_review++;
      } else if (status === 'expired') {
        statusBreakdown.expired++;
      }
    });

    // 8. Return analytics data
    return new Response(
      JSON.stringify({
        totalCampaigns: totalCampaigns || 0,
        activeCampaigns: activeCampaigns || 0,
        totalStores: totalStores || 0,
        campaignTrend,
        statusBreakdown
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[merchant-analytics] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
