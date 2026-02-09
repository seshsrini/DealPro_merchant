// @ts-ignore: Deno is a global in Deno runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// 1. GLOBAL CONSTANTS (Defined at top to avoid ReferenceErrors)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

// --- VALIDATION UTILS ---
export function isString(value: any): boolean {
  return typeof value === 'string';
}

// --- AUTHENTICATION ---
export async function authenticateRequest(req: Request, corsHeaders: HeadersInit): Promise<Response | any> {
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
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);

  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  return user;
}

// --- MAIN HANDLER ---
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const user = await authenticateRequest(req, corsHeaders);
    if (user instanceof Response) return user;

    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const { userId } = await req.json();

    if (!isString(userId) || userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized access.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { 
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } }, 
    });

    // FIX: Moved localized_shop_name from user_profiles to campaigns
    const { data, error } = await supabaseClient
      .from('campaign_interactions')
      .select(`
        *,
        campaigns!campaign_id (
          deal_heading, 
          offer_value, 
          image_url, 
          long_description, 
          localized_heading, 
          localized_offer, 
          localized_shop_name, 
          end_date
        ),
        user_profiles:merchant_id (
          store_name
        )
      `)
      .eq('consumer_id', userId)
      .order('redeemed_at', { ascending: false });

    if (error) {
      console.error('[redemptions/get-redemptions EF] Supabase select failed:', error.message);
      throw error;
    }

    const mappedData = (data || []).map((i: any) => {
      const campaign = i.campaigns || {};
      const profile = i.user_profiles || {};

      return {
        ...i,
        campaign_details: {
          shop_name: profile.store_name || 'Retail Partner',
          deal_heading: campaign.deal_heading || 'Reward Details Unavailable',
          offer_value: campaign.offer_value || 'Offer Unavailable',
          image_url: campaign.image_url || DEFAULT_DEAL_IMAGE,
          long_description: campaign.long_description || '',
          localized_heading: campaign.localized_heading || {},
          localized_offer: campaign.localized_offer || {},
          // CORRECTED: Mapped from campaign object
          localized_shop_name: campaign.localized_shop_name || {},
          endDate: campaign.end_date || undefined,
        },
      };
    });

    return new Response(JSON.stringify(mappedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[redemptions/get-redemptions EF] Catch Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});