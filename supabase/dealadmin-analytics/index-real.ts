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
    // 1. Authenticate
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No auth header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Auth failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // 2. Check role
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userProfile?.role !== 'dealadmin') {
      return new Response(
        JSON.stringify({ error: 'Not dealadmin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { period = '30' } = body;
    const periodDays = parseInt(period);

    // Initialize response data
    let totalCampaigns = 0;
    let activeCampaigns = 0;
    let totalMerchants = 0;
    let categoriesWithDeals: any[] = [];
    let campaignTrend: any[] = [];
    let statusBreakdown = { approved: 0, pending: 0, needs_review: 0, rejected: 0 };

    // 3. Get total campaigns (simple count)
    try {
      const { count } = await supabaseAdmin
        .from('campaigns')
        .select('*', { count: 'exact', head: true });
      totalCampaigns = count || 0;
      console.log('[analytics] Total campaigns:', totalCampaigns);
    } catch (e: any) {
      console.error('[analytics] Error counting campaigns:', e.message);
    }

    // 4. Get active campaigns (status = approved AND end_date >= today OR end_date is null)
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison

      // Fetch approved campaigns
      const { data: approvedCampaigns } = await supabaseAdmin
        .from('campaigns')
        .select('end_date')
        .eq('status', 'approved');

      // Filter for active ones (end_date >= today or null)
      if (approvedCampaigns) {
        activeCampaigns = approvedCampaigns.filter(c => {
          if (!c.end_date) return true; // No end date = always active

          const endDate = new Date(c.end_date);
          endDate.setHours(0, 0, 0, 0); // Set to start of day for comparison

          return endDate >= today; // end_date in the future or today
        }).length;
      }

      console.log('[analytics] Active campaigns:', activeCampaigns, 'out of', approvedCampaigns?.length || 0, 'approved');
      console.log('[analytics] Sample end_date:', approvedCampaigns?.[0]?.end_date);
    } catch (e: any) {
      console.error('[analytics] Error counting active campaigns:', e.message);
    }

    // 5. Get total merchants
    try {
      const { count } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'merchant');
      totalMerchants = count || 0;
      console.log('[analytics] Total merchants:', totalMerchants);
    } catch (e: any) {
      console.error('[analytics] Error counting merchants:', e.message);
    }

    // 6. Get campaign status breakdown
    try {
      const { data: statusData } = await supabaseAdmin
        .from('campaigns')
        .select('status');

      if (statusData) {
        statusData.forEach(c => {
          const status = c.status?.toLowerCase();
          if (status === 'approved') statusBreakdown.approved++;
          else if (status === 'pending') statusBreakdown.pending++;
          else if (status === 'needs_review') statusBreakdown.needs_review++;
          else if (status === 'rejected') statusBreakdown.rejected++;
        });
      }
      console.log('[analytics] Status breakdown:', statusBreakdown);
    } catch (e: any) {
      console.error('[analytics] Error fetching status breakdown:', e.message);
    }

    // 7. Get categories with deals
    try {
      const { data: campaigns } = await supabaseAdmin
        .from('campaigns')
        .select('merchant_id');

      if (campaigns && campaigns.length > 0) {
        const merchantIds = [...new Set(campaigns.map(c => c.merchant_id))];

        const { data: merchants } = await supabaseAdmin
          .from('user_profiles')
          .select('id, category')
          .in('id', merchantIds)
          .not('category', 'is', null);

        if (merchants) {
          const categoryCounts: Record<string, number> = {};
          campaigns.forEach(campaign => {
            const merchant = merchants.find(m => m.id === campaign.merchant_id);
            if (merchant?.category) {
              categoryCounts[merchant.category] = (categoryCounts[merchant.category] || 0) + 1;
            }
          });

          const total = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
          categoriesWithDeals = Object.entries(categoryCounts)
            .map(([category, count]) => ({
              category,
              count,
              percentage: total > 0 ? (count / total) * 100 : 0
            }))
            .sort((a, b) => b.count - a.count);
        }
      }
      console.log('[analytics] Categories:', categoriesWithDeals.length);
    } catch (e: any) {
      console.error('[analytics] Error fetching categories:', e.message);
    }

    // 8. Get campaign trend
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Initialize trend data
      const trendData: Record<string, number> = {};
      for (let i = 0; i < periodDays; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        trendData[date.toISOString().split('T')[0]] = 0;
      }

      const { data: trendCampaigns } = await supabaseAdmin
        .from('campaigns')
        .select('created_at')
        .gte('created_at', startDate.toISOString());

      if (trendCampaigns) {
        trendCampaigns.forEach(c => {
          const dateStr = c.created_at.split('T')[0];
          if (trendData[dateStr] !== undefined) {
            trendData[dateStr]++;
          }
        });
      }

      campaignTrend = Object.entries(trendData)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      console.log('[analytics] Trend data points:', campaignTrend.length);
    } catch (e: any) {
      console.error('[analytics] Error fetching trend:', e.message);
    }

    return new Response(
      JSON.stringify({
        totalCampaigns,
        activeCampaigns,
        totalMerchants,
        categoriesWithDeals,
        campaignTrend,
        statusBreakdown
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[dealadmin-analytics] Fatal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Server error',
        message: error.message,
        stack: error.stack?.substring(0, 500) // Limit stack trace
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
