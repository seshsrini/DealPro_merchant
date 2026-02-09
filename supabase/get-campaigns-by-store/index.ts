// @ts-ignore: Deno global runtime
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Validation helper
export function isString(value: any): boolean {
  return typeof value === 'string';
}

// Authentication Helper
export async function authenticateRequest(req: Request, corsHeaders: HeadersInit): Promise<Response | any> { 
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No access token' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);

  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  return user;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const authResult = await authenticateRequest(req, corsHeaders);
    if (authResult instanceof Response) return authResult;

    const { storeId } = await req.json();

    if (!isString(storeId) || storeId.length < 1) {
      return new Response(JSON.stringify({ error: 'Store ID is required.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
    });

    /**
     * UPDATED QUERY:
     * 1. localized_shop_name is kept in the campaigns table select.
     * 2. user_profiles join now only asks for store_name.
     * 3. column name is_deal_of_the_day used instead of is_dotd.
     */
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        campaign_id, merchant_id, shop_name, image_url, deal_heading, offer_value, category,
        long_description, latlong, start_date, end_date, status, is_deal_of_the_day, store_id, image_name,
        localized_description, localized_heading, localized_offer, localized_shop_name,
        user_profiles:merchant_id (store_name), 
        merchant_stores:store_id (address, city, state, landmark, latitude, longitude, store_hrs)
      `)
      .eq('store_id', storeId)
      .eq('status', 'active');

    if (error) throw error;

    // Fetch average ratings for merchants in this store's campaigns
    const merchantIds = [...new Set((data || []).map((d: any) => d.merchant_id))];
    const { data: ratingsData } = await supabase
      .from('merchant_ratings')
      .select('merchant_id, rating')
      .in('merchant_id', merchantIds);

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

    const deals = (data || []).map((d: any) => {
      // Coordinate Extraction logic
      let finalLat = d.merchant_stores?.latitude ?? null;
      let finalLng = d.merchant_stores?.longitude ?? null;

      if (finalLat === null && d.latlong && isString(d.latlong)) {
        const parts = d.latlong.split(',');
        if (parts.length === 2) {
          finalLat = parseFloat(parts[0].trim());
          finalLng = parseFloat(parts[1].trim());
        }
      }

      return {
        campaign_id: String(d.campaign_id),
        merchantId: d.merchant_id,
        shopName: d.user_profiles?.store_name || d.shop_name || 'Retail Partner',
        thumbnail: d.image_url || DEFAULT_DEAL_IMAGE,
        deal_heading: d.deal_heading || '',
        offer_value: d.offer_value || '',
        category: d.category || 'General',
        location: d.merchant_stores?.address || '',
        latitude: finalLat,
        longitude: finalLng,
        storeHrs: d.merchant_stores?.store_hrs || '',
        landmark: d.merchant_stores?.landmark || '',
        longDescription: d.long_description || '',
        localized_description: d.localized_description || {},
        localized_heading: d.localized_heading || {},
        localized_offer: d.localized_offer || {},
        localized_shop_name: d.localized_shop_name || {},
        start_date: d.start_date,
        end_date: d.end_date,
        status: d.status || 'active',
        is_deal_of_the_day: d.is_deal_of_the_day || false,
        city: d.merchant_stores?.city || '',
        state: d.merchant_stores?.state || '',
        image_name: d.image_name,
        rating: merchantRatings.get(d.merchant_id) || 0
      };
    });

    return new Response(JSON.stringify(deals), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[get-campaigns-by-store] Critical Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});