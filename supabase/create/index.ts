
// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Inlined content of validation.ts
export function isString(value: any): boolean {
  return typeof value === 'string';
}

export function isObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isDateString(value: string): boolean {
  return !isNaN(new Date(value).getTime());
}
// End of inlined validation.ts

// Inlined content of authenticateRequest
export async function authenticateRequest(req: Request, corsHeaders: HeadersInit): Promise<Response | any> { // Using 'any' for User type in EF context for simplicity
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No access token provided.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);

  if (error || !user) {
    console.error('[authenticateRequest] JWT authentication failed:', error?.message);
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  return user;
}
// End of inlined authenticateRequest

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Simplified methods
  'Access-Control-Max-Age': '86400',
};

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    const user = await authenticateRequest(req, corsHeaders); // Pass corsHeaders
    if (user instanceof Response) { // Check if authenticateRequest returned a Response
      return user;
    }
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${jwt}` },
      },
    });

    // Check if the authenticated user is a merchant
    const { data: merchantProfile, error: profileError } = await supabase
      .from('merchant_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || merchantProfile?.role !== 'merchant') {
      console.error(`[campaigns/create-campaign EF] User ${user.id} is not a merchant or profile not found.`);
      return new Response(JSON.stringify({ error: 'Unauthorized: Only merchants can create campaigns.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    const body = await req.json();
    const {
      merchant_id, shop_name, deal_heading, offer_value, category,
      long_description, latlong, start_date, end_date, store_id,
      image_url, image_name, localized_heading, localized_offer,
      localized_description, localized_shop_name, is_deal_of_the_day
    } = body;

    // Validate Input Data
    if (merchant_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Merchant ID mismatch.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (!isString(latlong as string) || (latlong as string).length < 1) {
      return new Response(JSON.stringify({ error: 'LatLong string is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(shop_name as string) || (shop_name as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Shop name is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(deal_heading as string) || (deal_heading as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Deal heading is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(offer_value as string) || (offer_value as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Offer value is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(category as string) || (category as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Category is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(long_description as string) || (long_description as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Long description is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(start_date as string) || !isDateString(start_date as string)) {
      return new Response(JSON.stringify({ error: 'Valid start date is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(end_date as string) || !isDateString(end_date as string)) {
      return new Response(JSON.stringify({ error: 'Valid end date is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(store_id as string) || (store_id as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Store ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(image_url as string) || (image_url as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Image URL is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(image_name as string) || (image_name as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Image name is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }


    const campaignPayload = {
      merchant_id,
      shop_name,
      deal_heading,
      offer_value,
      category,
      long_description,
      latlong, // Mapping the input string to campaigns.latlong
      start_date,
      end_date,
      store_id,
      image_url,
      image_name,
      localized_heading,
      localized_offer,
      localized_description,
      localized_shop_name,
      status: 'review', // Changed default status to 'review'
      // rating: 4.5, // Removed as per request
      is_deal_of_the_day: is_deal_of_the_day === true, // Use value from request, default to false
    };

    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaignPayload])
      .select()
      .single();

    if (error) {
      console.error('Failed to create campaign:', error.message);
      throw error;
    }

    return new Response(JSON.stringify({ message: 'Campaign created successfully', campaign: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (error: any) {
    console.error('Failed to create campaign:', error.message || error);
    let status = 500;
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('Unauthorized')) {
        status = 401; // Or 403
      } else if (error.message.includes('Method Not Allowed')) {
        status = 405;
      } else if (error.message.includes('required') || error.message.includes('Invalid')) {
        status = 400; // Bad Request
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});