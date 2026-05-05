/**
 * get-repeat-customers Edge Function
 * Returns repeat customer metrics for a merchant based on campaign_interactions.
 * A "repeat customer" is a consumer who has redeemed deals 2+ times from this merchant.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { merchantId } = await req.json();
    if (!merchantId) {
      return new Response(JSON.stringify({ error: 'merchantId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[get-repeat-customers] Fetching for merchant:', merchantId);

    // Get all redeemed interactions for this merchant
    const { data: interactions, error } = await supabase
      .from('campaign_interactions')
      .select('consumer_id, campaign_id, redeemed_at')
      .eq('merchant_id', merchantId)
      .eq('is_redeemed', true);

    if (error) throw error;

    if (!interactions || interactions.length === 0) {
      return new Response(JSON.stringify({
        totalCustomers: 0,
        repeatCustomers: 0,
        repeatRate: 0,
        avgRedemptionsPerCustomer: 0,
        totalRedemptions: 0,
        frequencyBreakdown: { once: 0, twice: 0, threeToFive: 0, sixPlus: 0 },
        topRepeaters: [],
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Group by consumer
    const consumerMap = new Map<string, { count: number; lastRedeemed: string; campaignIds: Set<string> }>();
    for (const row of interactions) {
      const entry = consumerMap.get(row.consumer_id);
      if (entry) {
        entry.count++;
        entry.campaignIds.add(row.campaign_id);
        if (row.redeemed_at > entry.lastRedeemed) entry.lastRedeemed = row.redeemed_at;
      } else {
        consumerMap.set(row.consumer_id, {
          count: 1,
          lastRedeemed: row.redeemed_at || '',
          campaignIds: new Set([row.campaign_id]),
        });
      }
    }

    const totalCustomers = consumerMap.size;
    const totalRedemptions = interactions.length;

    // Frequency breakdown
    let once = 0, twice = 0, threeToFive = 0, sixPlus = 0;
    const repeaters: { consumerId: string; count: number; uniqueDeals: number; lastRedeemed: string }[] = [];

    consumerMap.forEach((data, consumerId) => {
      if (data.count === 1) once++;
      else if (data.count === 2) twice++;
      else if (data.count <= 5) threeToFive++;
      else sixPlus++;

      if (data.count >= 2) {
        repeaters.push({
          consumerId,
          count: data.count,
          uniqueDeals: data.campaignIds.size,
          lastRedeemed: data.lastRedeemed,
        });
      }
    });

    const repeatCustomers = twice + threeToFive + sixPlus;
    const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;
    const avgRedemptionsPerCustomer = totalCustomers > 0 ? Number((totalRedemptions / totalCustomers).toFixed(1)) : 0;

    // Top 5 repeaters sorted by count
    repeaters.sort((a, b) => b.count - a.count);
    const topRepeaters = repeaters.slice(0, 5);

    // Fetch display names for top repeaters
    if (topRepeaters.length > 0) {
      const consumerIds = topRepeaters.map(r => r.consumerId);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, first_name')
        .in('id', consumerIds);

      if (profiles) {
        const nameMap = new Map(profiles.map(p => [p.id, p.first_name || 'Customer']));
        topRepeaters.forEach(r => {
          (r as any).name = nameMap.get(r.consumerId) || 'Customer';
        });
      }
    }

    const result = {
      totalCustomers,
      repeatCustomers,
      repeatRate,
      avgRedemptionsPerCustomer,
      totalRedemptions,
      frequencyBreakdown: { once, twice, threeToFive, sixPlus },
      topRepeaters,
    };

    console.log('[get-repeat-customers] Result:', totalCustomers, 'total,', repeatCustomers, 'repeat');
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[get-repeat-customers] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
