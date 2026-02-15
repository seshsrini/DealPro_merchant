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

    // 2. Verify user is a dealadmin
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || userProfile?.role !== 'dealadmin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
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

    console.log('[dealadmin-analytics] Fetching analytics for period:', isLifetime ? 'lifetime' : `${periodDays} days`, 'starting from:', startDateStr);

    // 3. Get total campaigns count (created in the selected period or all time)
    let totalCampaignsQuery = supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true });

    if (!isLifetime) {
      totalCampaignsQuery = totalCampaignsQuery.gte('created_at', startDate.toISOString());
    }

    const { count: totalCampaigns, error: totalError } = await totalCampaignsQuery;

    if (totalError) {
      console.error('[dealadmin-analytics] Error fetching total campaigns:', totalError);
      throw totalError;
    }

    // 4. Get active campaigns count (status = 'active' and end_date >= today or end_date is null, created in period)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for comparison

    // Fetch all active campaigns created in the selected period to filter by end_date
    let activeCampaignsQuery = supabaseAdmin
      .from('campaigns')
      .select('end_date, status')
      .eq('status', 'active');

    if (!isLifetime) {
      activeCampaignsQuery = activeCampaignsQuery.gte('created_at', startDate.toISOString());
    }

    const { data: activeCampaignsData, error: activeError } = await activeCampaignsQuery;

    if (activeError) {
      console.error('[dealadmin-analytics] Error fetching active campaigns:', activeError);
      throw activeError;
    }

    // Filter for truly active ones (end_date >= today or null)
    const activeCampaigns = activeCampaignsData?.filter(c => {
      if (!c.end_date) return true; // No end date = always active

      const endDate = new Date(c.end_date);
      endDate.setHours(0, 0, 0, 0); // Set to start of day for comparison

      return endDate >= today; // end_date in the future or today
    }).length || 0;

    console.log('[dealadmin-analytics] Active campaigns (created in period):', activeCampaigns, 'out of', activeCampaignsData?.length || 0, 'with status=active');

    // 5. Get total merchants count
    const { count: totalMerchants, error: merchantsError } = await supabaseAdmin
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'merchant');

    if (merchantsError) {
      console.error('[dealadmin-analytics] Error fetching merchants:', merchantsError);
      throw merchantsError;
    }

    // 6. Get categories with deals (campaigns created in the selected period or all time)
    let campaignsForCategoriesQuery = supabaseAdmin
      .from('campaigns')
      .select('campaign_id, merchant_id');

    if (!isLifetime) {
      campaignsForCategoriesQuery = campaignsForCategoriesQuery.gte('created_at', startDate.toISOString());
    }

    const { data: campaignsData, error: campaignsError } = await campaignsForCategoriesQuery;

    if (campaignsError) {
      console.error('[dealadmin-analytics] Error fetching campaigns for categories:', campaignsError);
      throw campaignsError;
    }

    // Get merchant categories
    const merchantIds = [...new Set(campaignsData?.map(c => c.merchant_id) || [])];
    const { data: merchantsData, error: merchantsCategoryError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, category')
      .in('id', merchantIds)
      .not('category', 'is', null);

    if (merchantsCategoryError) {
      console.error('[dealadmin-analytics] Error fetching merchant categories:', merchantsCategoryError);
      throw merchantsCategoryError;
    }

    // Count campaigns per category
    const categoryCounts: Record<string, number> = {};
    campaignsData?.forEach(campaign => {
      const merchant = merchantsData?.find(m => m.id === campaign.merchant_id);
      if (merchant?.category) {
        categoryCounts[merchant.category] = (categoryCounts[merchant.category] || 0) + 1;
      }
    });

    const totalCampaignsForCategories = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
    const categoriesWithDeals = Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: totalCampaignsForCategories > 0 ? (count / totalCampaignsForCategories) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    // 7. Get campaign creation trend (last N days, or last 90 days for lifetime)
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
      .gte('created_at', trendStartDate.toISOString());

    if (trendError) {
      console.error('[dealadmin-analytics] Error fetching trend data:', trendError);
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

    // 8. Get status breakdown (campaigns created in the selected period or all time)
    let statusQuery = supabaseAdmin
      .from('campaigns')
      .select('status');

    if (!isLifetime) {
      statusQuery = statusQuery.gte('created_at', startDate.toISOString());
    }

    const { data: statusData, error: statusError } = await statusQuery;

    if (statusError) {
      console.error('[dealadmin-analytics] Error fetching status data:', statusError);
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

    // 9. Return analytics data
    return new Response(
      JSON.stringify({
        totalCampaigns: totalCampaigns || 0,
        activeCampaigns: activeCampaigns || 0,
        totalMerchants: totalMerchants || 0,
        categoriesWithDeals,
        campaignTrend,
        statusBreakdown
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[dealadmin-analytics] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
