// @ts-ignore: Deno global
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

// Authentication Helper
export async function authenticateRequest(req: Request, corsHeaders: HeadersInit) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
    status: 401 
  });

  return user;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Authenticate the User
    const user = await authenticateRequest(req, corsHeaders);
    if (user instanceof Response) return user;

    // 2. Parse Search Term safely
    const body = await req.json().catch(() => ({}));
    const searchTerm = (body.searchTerm || '').trim();

    // Relaxed validation: Allow 1-character searches for better UX
    if (!searchTerm || searchTerm.length < 1) {
      return new Response(JSON.stringify({ error: 'Search term is required.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
    });

    const searchPattern = `%${searchTerm}%`;

    /**
     * SEARCH STRATEGY:
     * Query the database VIEW 'searchable_stores' created previously.
     * This view merges 'merchant_stores' and 'user_profiles' into one flat structure.
     */
    const { data, error } = await supabase
      .from('searchable_stores')
      .select('*')
      .or(`branch_name.ilike.${searchPattern},brand_name.ilike.${searchPattern},address.ilike.${searchPattern},city.ilike.${searchPattern}`)
      .order('branch_name', { ascending: true }) // Sort alphabetically
      .limit(20);

    if (error) {
        console.error('Database Error:', error.message);
        throw error;
    }

    // 3. Transformation: Ensure we return consistent store_name
    const stores = (data || []).map((item: any) => ({
      id: item.id,
      // Priority: Specific Branch Name -> Brand/Merchant Name -> Fallback
      store_name: item.branch_name || item.brand_name || 'Retail Partner',
      address: item.address,
      city: item.city,
      state: item.state,
      pincode: item.pincode
    }));

    return new Response(JSON.stringify(stores), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Search Error]:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});