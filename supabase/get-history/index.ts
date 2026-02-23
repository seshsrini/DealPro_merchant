import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No auth header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

    // 2. The Corrected Query
    // We move localized_shop_name into the campaigns join
    const { data, error } = await supabase
      .from('campaign_interactions')
      .select(`
        interaction_id,
        redeemed_at,
        is_redeemed,
        claim_no,
        campaigns!campaign_id (
          deal_heading,
          localized_heading,
          localized_shop_name,
          image_url
        ),
        merchant_profiles!merchant_id (
          store_name
        )
      `)
      .eq('consumer_id', user.id)
      .eq('is_redeemed', true)
      .order('redeemed_at', { ascending: false });

    if (error) throw error;

    // 3. Transformation
    const history = (data || []).map((item: any) => ({
      id: item.interaction_id,
      redeemedAt: item.redeemed_at,
      claimNo: item.claim_no,
      dealHeading: item.campaigns?.deal_heading || '',
      // Map from campaigns, not user_profiles
      localized_shop_name: item.campaigns?.localized_shop_name || {},
      shopName: item.merchant_profiles?.store_name || 'Retail Partner',
      thumbnail: item.campaigns?.image_url || '',
      localized_heading: item.campaigns?.localized_heading || {}
    }));

    return new Response(JSON.stringify(history), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[redemption/get-history EF] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});