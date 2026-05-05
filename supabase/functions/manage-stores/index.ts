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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!jwt) throw new Error('Unauthorized: No access token provided.');

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error } = await admin.auth.getUser(jwt);
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
    const { action } = body;

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve effective merchant ID — supports both owners and staff members
    // Staff members operate under the owner's merchant_id
    let merchantId = user.id;
    const { data: staffRow } = await admin
      .from('merchant_staff')
      .select('merchant_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('role', { ascending: true })
      .limit(5);

    if (staffRow && staffRow.length > 0) {
      // Prefer the row where this user is staff/manager of another merchant
      const staffEntry = staffRow.find(r => r.merchant_id !== user.id) || staffRow[0];
      merchantId = staffEntry.merchant_id;
    } else {
      // No merchant_staff row — check merchant_profiles directly
      const { data: profile } = await admin
        .from('merchant_profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) {
        merchantId = profile.id;
      }
    }
    console.log('[manage-stores] Resolved merchantId:', merchantId, 'from userId:', user.id);

    // ── UPDATE STORE ──
    if (action === 'update') {
      const { storeId, data } = body;
      if (!storeId) {
        return new Response(JSON.stringify({ error: 'storeId is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const allowed: Record<string, unknown> = {};
      if (typeof data.store_name === 'string') allowed.store_name = data.store_name;
      if (typeof data.address === 'string') allowed.address = data.address;
      if (typeof data.landmark === 'string') allowed.landmark = data.landmark;
      if (typeof data.locality === 'string') allowed.locality = data.locality;
      if (typeof data.city === 'string') allowed.city = data.city;
      if (typeof data.state === 'string') allowed.state = data.state;
      if (typeof data.pincode === 'string') allowed.pincode = data.pincode;
      if (typeof data.latitude === 'number') allowed.latitude = data.latitude;
      if (typeof data.longitude === 'number') allowed.longitude = data.longitude;
      if (typeof data.store_hrs === 'string') allowed.store_hrs = data.store_hrs;
      if (typeof data.store_category === 'string') allowed.store_category = data.store_category;
      if (typeof data.store_phone === 'string') allowed.store_phone = data.store_phone || null;
      if (typeof data.store_phone_alt === 'string') allowed.store_phone_alt = data.store_phone_alt || null;
      if (typeof data.delivers === 'boolean') allowed.delivers = data.delivers;
      if (data.delivers === true && data.delivery_radius_km != null) {
        allowed.delivery_radius_km = Number(data.delivery_radius_km);
      } else if (data.delivers === false) {
        allowed.delivery_radius_km = null;
      }

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
        store_category: store.store_category || null,
        store_phone: store.store_phone || null,
        store_phone_alt: store.store_phone_alt || null,
        delivers: store.delivers || false,
        delivery_radius_km: store.delivers && store.delivery_radius_km != null ? Number(store.delivery_radius_km) : null,
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

    // ── DELETE STORE ──
    if (action === 'delete') {
      const { storeId } = body;
      if (!storeId) {
        return new Response(JSON.stringify({ error: 'storeId is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Expire all active/pending/review campaigns linked to this store before deleting it
      const now = new Date().toISOString();
      const { count: expiredCount } = await admin
        .from('campaigns')
        .update({ status: 'expired', modified_at: now, last_modified: now })
        .eq('store_id', storeId)
        .eq('merchant_id', merchantId)
        .in('status', ['active', 'review', 'pending'])
        .select('*', { count: 'exact', head: true });

      console.log(`[manage-stores] Expired ${expiredCount ?? 0} campaign(s) for store ${storeId}`);

      // Soft-delete the store (preserve row for records)
      const { error: deleteErr } = await admin
        .from('merchant_stores')
        .update({ active_status: 'disabled' })
        .eq('id', storeId)
        .eq('merchant_id', merchantId);

      if (deleteErr) throw deleteErr;

      return new Response(JSON.stringify({ success: true, expiredCampaigns: expiredCount ?? 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use "update", "add", or "delete".' }), {
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
