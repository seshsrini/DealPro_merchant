import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// 1. CORS Configuration
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

Deno.serve(async (req) => {
  // Handle Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Ensure POST method
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; 

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse search parameters
    const { latitude, longitude, radius, cityFilter } = await req.json();

    let data;
    let fetchError;

    // 2. Logic Branching
    if (latitude && longitude && radius) {
      // Use the RPC for Radius Search
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_campaigns_in_radius', {
        user_lat: latitude,
        user_lng: longitude,
        search_radius_km: radius,
      });
      data = rpcData;
      fetchError = rpcError;
    } else {
      // Standard fetch querying the VIEW for clean text filtering
      let query = supabase
        .from('campaigns')
        .select(`
          *,
          user_profiles:merchant_id (store_name), 
          merchant_stores:store_id (address, city, state, landmark, latitude, longitude, store_hrs)
        `)
        .eq('status', 'active');

      if (cityFilter) {
        // Querying the joined merchant_stores city
        query = query.ilike('merchant_stores.city', `%${cityFilter}%`);
      }

      const { data: tableData, error: tableError } = await query;
      data = tableData;
      fetchError = tableError;
    }

    if (fetchError) throw fetchError;

    // 2.5. Fetch average ratings for all merchants
    const merchantIds = [...new Set((data || []).map((d: any) => d.merchant_id))];

    // Only fetch ratings if we have merchant IDs
    let ratingsData = null;
    if (merchantIds.length > 0) {
      const { data: ratings } = await supabase
        .from('merchant_ratings')
        .select('merchant_id, rating')
        .in('merchant_id', merchantIds);
      ratingsData = ratings;
    }

    // Calculate average ratings per merchant
    const merchantRatings = new Map<string, number>();
    if (ratingsData) {
      const ratingsByMerchant = ratingsData.reduce((acc: any, r: any) => {
        if (!acc[r.merchant_id]) acc[r.merchant_id] = [];
        acc[r.merchant_id].push(r.rating);
        return acc;
      }, {});

      Object.entries(ratingsByMerchant).forEach(([merchantId, ratings]: [string, any]) => {
        const avgRating = ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length;
        merchantRatings.set(merchantId, avgRating);
      });
    }

    // 3. Data Transformation & Mapping
    const deals = (data || []).map((d: any) => {
      // Handle coordinate extraction
      let finalLat = d.merchant_stores?.latitude ?? null;
      let finalLng = d.merchant_stores?.longitude ?? null;

      // Fallback for manual latlong string parsing if necessary
      if (finalLat === null && d.latlong && typeof d.latlong === 'string') {
        const parts = d.latlong.split(',');
        if (parts.length === 2) {
          finalLat = parseFloat(parts[0].trim());
          finalLng = parseFloat(parts[1].trim());
        }
      }

      return {
        campaign_id: String(d.campaign_id || d.id),
        merchantId: d.merchant_id,
        shopName: d.shop_name || d.user_profiles?.store_name || 'Retail Partner',
        thumbnail: d.image_url || DEFAULT_DEAL_IMAGE,
        deal_heading: d.deal_heading || '',
        offer_value: d.offer_value || '',
        category: d.category || 'General',
        location: d.merchant_stores?.address || d.address || '',
        latitude: finalLat,
        longitude: finalLng,
        storeHrs: d.merchant_stores?.store_hrs || '',
        landmark: d.merchant_stores?.landmark || d.landmark || '',
        discountCode: d.discount_code || '',
        longDescription: d.long_description || '',
        localized_description: d.localized_description || {},
        localized_heading: d.localized_heading || {},
        localized_offer: d.localized_offer || {},
        localized_shop_name: d.localized_shop_name || {},
        start_date: d.start_date,
        end_date: d.end_date,
        status: d.status || 'active',
        city: d.merchant_stores?.city || d.city || '',
        state: d.merchant_stores?.state || d.state || '',
        image_name: d.image_name,
        rating: merchantRatings.get(d.merchant_id) || 0
      };
    });

    return new Response(JSON.stringify(deals), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[get-all-campaigns] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});