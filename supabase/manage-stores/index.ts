// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!jwt) throw new Error('Unauthorized: No access token provided.');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) {
    console.error('[manage-stores] Auth failed:', error?.message);
    throw new Error('Unauthorized: Invalid or expired token.');
  }
  return user;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const user = await authenticateRequest(req);
    const body = await req.json();
    const { action, merchantId } = body;

    // Security: merchant can only manage their own stores
    if (merchantId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: ID mismatch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // ── UPDATE STORE ──
    if (action === 'update') {
      const { storeId, data } = body;
      if (!storeId) {
        return new Response(JSON.stringify({ error: 'storeId is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Only allow updating address fields, not store_name
      const allowed: Record<string, unknown> = {};
      if (typeof data.address === 'string') allowed.address = data.address;
      if (typeof data.landmark === 'string') allowed.landmark = data.landmark;
      if (typeof data.locality === 'string') allowed.locality = data.locality;
      if (typeof data.city === 'string') allowed.city = data.city;
      if (typeof data.state === 'string') allowed.state = data.state;
      if (typeof data.pincode === 'string') allowed.pincode = data.pincode;
      if (typeof data.latitude === 'number') allowed.latitude = data.latitude;
      if (typeof data.longitude === 'number') allowed.longitude = data.longitude;
      if (typeof data.store_hrs === 'string') allowed.store_hrs = data.store_hrs;

      if (Object.keys(allowed).length === 0) {
        return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const { data: updated, error: updateErr } = await admin
        .from('merchant_stores')
        .update(allowed)
        .eq('id', storeId)
        .eq('merchant_id', merchantId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ store: updated }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // ── ADD STORE ──
    if (action === 'add') {
      const { store } = body;
      if (!store || !store.store_name || !store.address || !store.city || !store.state) {
        return new Response(JSON.stringify({ error: 'store_name, address, city, state are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const row = {
        merchant_id: merchantId,
        store_name: store.store_name,
        address: store.address,
        landmark: store.landmark || null,
        locality: store.locality || null,
        city: store.city,
        state: store.state,
        latitude: store.latitude || 0,
        longitude: store.longitude || 0,
        store_hrs: store.store_hrs || null,
        pincode: store.pincode || null,
      };

      const { data: inserted, error: insertErr } = await admin
        .from('merchant_stores')
        .insert(row)
        .select()
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ store: inserted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use "update" or "add".' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });

  } catch (error: any) {
    console.error('[manage-stores] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message.includes('Unauthorized') ? 401 : 500,
    });
  }
});
