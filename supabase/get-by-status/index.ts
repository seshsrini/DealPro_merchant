// @ts-ignore: Deno global
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// --- Helpers (Inlined for consistency with your working code) ---

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export function isString(value: any): boolean {
  return typeof value === 'string';
}

async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) throw new Error('Unauthorized: No access token provided.');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new Error('Unauthorized: Invalid or expired token.');
  
  return { user, jwt };
}

// --- Main Handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1. Authenticate using your established pattern
    const { user, jwt } = await authenticateRequest(req);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; 
    
    // 2. Initialize with Service Role to ensure Admin can see all records
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Parse Status from Body
    const { status } = await req.json().catch(() => ({ status: 'review' }));

    // 4. Fetch Campaigns with store details
    const { data, error: dbError } = await supabase
      .from('campaigns')
      .select(`
        *,
        merchant_stores:store_id (
          store_name,
          city,
          address
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (dbError) throw dbError;

    // 5. MAP THE DATA (Crucial for Image Display)
    // We provide both image_url (db name) and url (UI component name)
    const campaigns = (data || []).map((item: any) => ({
      ...item,
      // Mapping keys to match your working "get-merchant-images" format
      url: item.image_url, 
      name: item.image_name,
      // Nesting fix for some UI components
      store_name: item.merchant_stores?.store_name || item.shop_name,
      city: item.merchant_stores?.city || ''
    }));

    return new Response(JSON.stringify(campaigns), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[get-by-status] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message?.includes('Unauthorized') ? 401 : 500,
    });
  }
});