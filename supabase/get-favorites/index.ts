// @ts-ignore: Deno is a global in Deno runtime
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

// Inlined content of authenticateRequest
export async function authenticateRequest(req: Request, corsHeaders: HeadersInit) {
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
    console.error('[authenticateRequest] JWT authentication failed:', error?.message);
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token.' }), {
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const user = await authenticateRequest(req, corsHeaders);
    if (user instanceof Response) return user;

    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { userId } = await req.json();

    if (!isString(userId) || userId.length < 1) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Access denied.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    /**
     * CLEANED QUERY:
     * 1. Uses !fk_favorites_merchant to resolve relationship ambiguity.
     * 2. Fetches campaigns and merchant_stores.
     * 3. Completely removed localized_shop_name to avoid "column does not exist" errors.
     */
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        *,
        user_profiles!fk_favorites_merchant (
          store_name,
          category
        ),
        campaigns (
          *,
          merchant_stores (*)
        )
      `)
      .eq('user_id', userId)
      .eq('active_favorite', true);

    if (error) {
      console.error('[user/get-favorites EF] Supabase select failed:', error.message);
      throw error;
    }

    const mappedData = (data || []).map((fav: any) => {
        const c = fav.campaigns;
        const mStore = c?.merchant_stores; 
        const mProfile = fav.user_profiles;

        return {
          id: String(fav.campaign_id),
          merchantId: fav.merchant_id,
          shopName: mProfile?.store_name || c?.shop_name || 'Retail Partner',
          thumbnail: c?.image_url || DEFAULT_DEAL_IMAGE,
          dealHeading: c?.deal_heading || '',
          offerValue: c?.offer_value || '',
          category: mProfile?.category || c?.category || 'General',
          location: mStore?.address || '',
          latitude: mStore?.latitude || 0,
          longitude: mStore?.longitude || 0,
          longDescription: c?.long_description || '',
          localized_heading: c?.localized_heading || {},
          localized_offer: c?.localized_offer || {},
          localized_description: c?.localized_description || {},
          // localized_shop_name removed as requested
          status: c?.status || 'active',
          city: mStore?.city || '',
        };
    });

    return new Response(JSON.stringify(mappedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[user/get-favorites EF] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});