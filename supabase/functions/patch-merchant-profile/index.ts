// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined; };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const body = await req.json();

    const {
      fullName, storeName, category,
      businessType, gstin, pan, udyamNo, fssaiNo, tradeLicenseNo,
      termsAccepted, privacyAccepted,
      stores, // optional: array of store objects to upsert
    } = body;

    // Build partial update — only include fields that were explicitly provided
    const profilePatch: Record<string, any> = {};
    if (fullName !== undefined)       profilePatch.full_name   = fullName;
    if (storeName !== undefined)      profilePatch.store_name  = storeName;
    if (category !== undefined)       profilePatch.category    = category;
    if (businessType !== undefined)   profilePatch.business_type = businessType;
    if (termsAccepted !== undefined)  profilePatch.terms_accepted  = termsAccepted;
    if (privacyAccepted !== undefined) profilePatch.privacy_accepted = privacyAccepted;

    // Business document fields — only include when businessType is present to avoid stomping
    if (businessType === 'gstin') {
      if (gstin !== undefined) profilePatch.gstin = gstin;
      if (pan !== undefined)   profilePatch.pan   = pan;
      profilePatch.udyam_no          = null;
      profilePatch.fssai_no          = null;
      profilePatch.trade_license_no  = null;
    } else if (businessType === 'udyam') {
      if (udyamNo !== undefined) profilePatch.udyam_no = udyamNo ? udyamNo.toUpperCase() : null;
      profilePatch.gstin             = null;
      profilePatch.pan               = null;
      profilePatch.fssai_no          = null;
      profilePatch.trade_license_no  = null;
    } else if (businessType === 'fssai') {
      if (fssaiNo !== undefined) profilePatch.fssai_no = fssaiNo;
      profilePatch.gstin             = null;
      profilePatch.pan               = null;
      profilePatch.udyam_no          = null;
      profilePatch.trade_license_no  = null;
    } else if (businessType === 'trade_license') {
      if (tradeLicenseNo !== undefined) profilePatch.trade_license_no = tradeLicenseNo ? tradeLicenseNo.toUpperCase() : null;
      profilePatch.gstin             = null;
      profilePatch.pan               = null;
      profilePatch.udyam_no          = null;
      profilePatch.fssai_no          = null;
    }

    // Update merchant_profiles if there's anything to patch
    if (Object.keys(profilePatch).length > 0) {
      const { error: profileError } = await adminClient
        .from('merchant_profiles')
        .update(profilePatch)
        .eq('id', user.id);

      if (profileError) {
        console.error('[PatchMerchantProfile] Profile update error:', profileError.message);
        return new Response(JSON.stringify({ error: `Profile update failed: ${profileError.message}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    // Upsert stores if provided (delete existing, insert new)
    if (Array.isArray(stores) && stores.length > 0) {
      await adminClient.from('merchant_stores').delete().eq('merchant_id', user.id);

      const storeInserts = stores.map((s: any) => ({
        merchant_id:    user.id,
        store_name:     s.store_name || storeName || '',
        address:        s.address,
        landmark:       s.landmark       || null,
        locality:       s.locality       || null,
        city:           s.city,
        state:          s.state,
        store_category: s.store_category || null,
        latitude:       s.latitude       || 0,
        longitude:      s.longitude      || 0,
        store_hrs:      s.store_hrs,
        pincode:        s.pincode,
        store_phone:    s.store_phone    || null,
        store_phone_alt: s.store_phone_alt || null,
        delivers:       s.delivers       || false,
        delivery_radius_km: s.delivers ? (s.delivery_radius_km || null) : null,
      }));

      const { error: storeError } = await adminClient
        .from('merchant_stores')
        .insert(storeInserts);

      if (storeError) {
        console.error('[PatchMerchantProfile] Store upsert error:', storeError.message);
        return new Response(JSON.stringify({ error: `Store save failed: ${storeError.message}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      console.log('[PatchMerchantProfile] Stores saved for:', user.id, '—', stores.length, 'store(s)');
    }

    console.log('[PatchMerchantProfile] Patched profile for:', user.id, '— fields:', Object.keys(profilePatch));

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[PatchMerchantProfile] Error:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
