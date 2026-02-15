import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { latitude, longitude, radius, cityFilter } = await req.json();

    console.log('[get-deals-of-day] Request params:', { latitude, longitude, radius, cityFilter });

    // Validate: Either coordinates OR cityFilter must be provided
    const hasCoords = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;
    const hasCity = cityFilter && cityFilter.trim() !== '';

    if (!hasCoords && !hasCity) {
      return new Response(
        JSON.stringify({ error: 'Either (latitude and longitude) or cityFilter is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const searchRadius = radius || 5.0; // Default 5km radius
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    console.log('[get-deals-of-day] Searching for Deal of Day campaigns');
    console.log('[get-deals-of-day] Location:', { latitude, longitude, radius: searchRadius });
    console.log('[get-deals-of-day] Today:', todayStr);

    // Query campaigns table with Deal of the Day filters
    const { data: campaigns, error: campaignsError } = await supabaseClient
      .from('campaigns')
      .select(`
        *,
        merchant_stores!inner (
          *
        )
      `)
      .eq('is_deal_of_the_day', true) // ONLY Deal of the Day campaigns
      .eq('status', 'active') // ONLY active campaigns
      .gte('start_date', todayStr); // ONLY today and future dates

    if (campaignsError) {
      console.error('[get-deals-of-day] Error fetching campaigns:', campaignsError);
      throw campaignsError;
    }

    console.log(`[get-deals-of-day] Found ${campaigns?.length || 0} Deal of Day campaigns before filtering`);

    // Filter by city OR distance
    let filteredCampaigns;

    if (hasCity) {
      // City-based filtering: Match all campaigns in the specified city
      console.log(`[get-deals-of-day] Filtering by city: ${cityFilter}`);
      filteredCampaigns = (campaigns || []).filter(campaign => {
        const store = campaign.merchant_stores;
        return store?.city?.toLowerCase() === cityFilter.toLowerCase();
      });
      console.log(`[get-deals-of-day] After city filter: ${filteredCampaigns.length} campaigns in ${cityFilter}`);
    } else {
      // Distance-based filtering: Use Haversine formula
      console.log(`[get-deals-of-day] Filtering by distance: ${searchRadius}km from (${latitude}, ${longitude})`);
      filteredCampaigns = (campaigns || []).filter(campaign => {
        const store = campaign.merchant_stores;
        if (!store?.latitude || !store?.longitude) return false;

        const R = 6371; // Earth's radius in km
        const dLat = (store.latitude - latitude) * Math.PI / 180;
        const dLon = (store.longitude - longitude) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(latitude * Math.PI / 180) * Math.cos(store.latitude * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance <= searchRadius;
      });
      console.log(`[get-deals-of-day] After distance filter: ${filteredCampaigns.length} campaigns within ${searchRadius}km`);
    }

    // Get merchant IDs for rating lookup
    const merchantIds = [...new Set(filteredCampaigns.map(c => c.merchant_id))];

    // Fetch merchant ratings
    const merchantRatings = new Map<string, number>();
    if (merchantIds.length > 0) {
      const { data: ratingsData } = await supabaseClient
        .from('merchants')
        .select('id, rating')
        .in('id', merchantIds);

      if (ratingsData) {
        ratingsData.forEach(m => {
          if (m.rating !== null && m.rating !== undefined) {
            merchantRatings.set(m.id, m.rating);
          }
        });
      }
    }

    // Format response
    const deals = filteredCampaigns.map(d => {
      const store = d.merchant_stores;
      return {
        campaign_id: String(d.campaign_id || d.id),
        merchantId: d.merchant_id,
        shop_name: d.shop_name,
        deal_heading: d.deal_heading,
        offer_value: d.offer_value,
        category: d.category,
        long_description: d.long_description,
        isDealOfTheDay: true, // Always true for this endpoint
        latlong: d.latlong,
        image_url: d.image_url,
        localized_description: d.localized_description || {},
        localized_heading: d.localized_heading || {},
        localized_offer: d.localized_offer || {},
        localized_shop_name: d.localized_shop_name || {},
        start_date: d.start_date,
        end_date: d.end_date,
        status: d.status || 'active',
        city: store?.city || d.city || '',
        state: store?.state || d.state || '',
        address: store?.address || '',
        landmark: store?.landmark || '',
        storeHrs: store?.store_hours || store?.storeHrs || store?.store_hrs || '',
        image_name: d.image_name,
        is_deal_of_the_day: true, // Always true for this endpoint
        rating: merchantRatings.get(d.merchant_id) || 0
      };
    });

    console.log('[get-deals-of-day] Returning ${deals.length} Deal of Day campaigns');

    return new Response(JSON.stringify(deals), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[get-deals-of-day] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
