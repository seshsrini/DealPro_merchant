
// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Inlined content of validation.ts
export function isValidUUID(uuid: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  const regex = /^\+[1-9]\d{1,14}$/; // E.g., +919999999999
  return regex.test(phone);
}

export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && value >= 0;
}

export function isString(value: any): boolean {
  return typeof value === 'string';
}

export function isBoolean(value: any): boolean {
  return typeof value === 'boolean';
}

export function isObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: any): boolean {
  return Array.isArray(value);
}

export function isDateString(value: string): boolean {
  return !isNaN(new Date(value).getTime());
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, at most 15, one uppercase, one number, and no spaces.
  const regex = /^(?=.*[A-Z])(?=.*\d)[^\s]{8,15}$/;
  return regex.test(password);
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
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
};

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

Deno.serve(async (req) => {
  // 1. MUST handle OPTIONS for browser preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') { // Use POST to get userId in body
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authResult = await authenticateRequest(req, corsHeaders); // Pass corsHeaders
    if (authResult instanceof Response) {
      return authResult; // If it's a Response, return it directly
    }
    const user = authResult; // Otherwise, it's the User object
    console.log(`[redemption/get-pending-surveys EF] Authenticated user ID: ${user.id}`);
    // Re-extract the JWT from the incoming request's Authorization header
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${jwt}` }, // Pass the JWT here!
      },
    });

    const { userId } = await req.json();
    console.log(`[redemption/get-pending-surveys EF] Received userId in body: ${userId}`);

    // 1. Validate Input Data
    if (!isString(userId) || userId.length < 1) {
      console.error('[redemption/get-pending-surveys EF] Validation Error: User ID is required.');
      return new Response(JSON.stringify({ error: 'User ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    // Authorization check: userId must match the authenticated user's ID
    if (userId !== user.id) {
      console.error(`[redemption/get-pending-surveys EF] Authorization Error: userId mismatch. Authenticated: ${user.id}, Requested: ${userId}`);
      return new Response(JSON.stringify({ error: 'Unauthorized: Cannot access another user\'s pending surveys.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    // Fetch all redeemed interactions for the user
    const { data: interactions, error: interactionsError } = await supabase
      .from('campaign_interactions')
      .select('*, campaigns (deal_heading, offer_value, image_url, long_description, localized_heading, localized_offer, end_date), user_profiles:merchant_id (store_name, localized_shop_name)')
      .eq('consumer_id', userId)
      .eq('is_redeemed', true)
      .order('interaction_id', { ascending: false });

    if (interactionsError) {
      console.error('[redemption/get-pending-surveys EF] Supabase select (interactions) failed:', interactionsError.message);
      throw interactionsError;
    }
    console.log(`[redemption/get-pending-surveys EF] Raw interactions fetched: ${interactions?.length || 0} records.`);

    // Fetch all ratings given by the user
    const { data: ratings, error: ratingsError } = await supabase
      .from('merchant_ratings')
      .select('campaign_id')
      .eq('consumer_id', userId);

    if (ratingsError) {
      console.error('[redemption/get-pending-surveys EF] Supabase select (ratings) failed:', ratingsError.message);
      throw ratingsError;
    }
    console.log(`[redemption/get-pending-surveys EF] Raw ratings fetched: ${ratings?.length || 0} records.`);

    const ratedIds = new Set(ratings?.map(r => r.campaign_id) || []);
    
    // Filter out interactions that already have a rating
    const filteredSurveys = (interactions || [])
      .filter(i => !ratedIds.has(i.campaign_id))
      .map((i: any) => {
        // Ensure campaign_details is always an object with fallbacks
        const campaignDetails = {
          shop_name: i.user_profiles?.store_name || i.campaigns?.shop_name || 'Retail Partner',
          deal_heading: i.campaigns?.deal_heading || 'Reward Details Unavailable',
          offer_value: i.campaigns?.offer_value || 'Offer Unavailable',
          image_url: i.campaigns?.image_url || DEFAULT_DEAL_IMAGE,
          long_description: i.campaigns?.long_description || 'No detailed description.',
          localized_heading: i.campaigns?.localized_heading || {},
          localized_offer: i.campaigns?.localized_offer || {},
          localized_shop_name: i.user_profiles?.localized_shop_name || i.campaigns?.localized_shop_name || {},
          endDate: i.campaigns?.end_date || undefined,
        };
        return {
          ...i,
          campaign_details: campaignDetails,
        };
      });
    console.log(`[redemption/get-pending-surveys EF] Filtered pending surveys: ${filteredSurveys.length} records. Sample:`, filteredSurveys[0]);

    return new Response(JSON.stringify(filteredSurveys), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[redemption/get-pending-surveys EF] Failed to fetch pending surveys:', error.message || error);
    let status = 500;
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('Unauthorized')) {
        status = 401;
      } else if (error.message.includes('Method Not Allowed')) {
        status = 405;
      } else if (error.message.includes('User ID is required')) {
        status = 400; // Bad Request
      } else if (error.code === 'PGRST116') { // Specific error for no rows found
        status = 404;
        error.message = 'No pending surveys found for this user.';
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});