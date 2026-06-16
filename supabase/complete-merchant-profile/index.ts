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

    // Authenticate the user via JWT
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
      fullName, storeName, legalName, category, businessType,
      gstin, pan, udyamNo, fssaiNo, tradeLicenseNo,
      termsAccepted, privacyAccepted, stores,
    } = body;

    // Validate required fields
    if (!fullName || !storeName) {
      return new Response(JSON.stringify({ error: 'Missing required fields: fullName, storeName' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    // Default to 'none' if merchant has no formal registration
    const effectiveBusinessType = businessType || 'none';

    if (!termsAccepted || !privacyAccepted) {
      return new Response(JSON.stringify({ error: 'Terms and Privacy Policy must be accepted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!stores || !Array.isArray(stores) || stores.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one store is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('[CompleteMerchantProfile] Updating profile for:', user.id);

    // Update merchant_profiles
    const profileUpdate: Record<string, unknown> = {
      full_name: fullName,
      store_name: storeName,
      legal_name: legalName || storeName,
      category: category || 'General',
      business_type: effectiveBusinessType,
      gstin: effectiveBusinessType === 'gstin' ? gstin : null,
      pan: effectiveBusinessType === 'gstin' ? pan : null,
      udyam_no: effectiveBusinessType === 'udyam' ? (udyamNo ? udyamNo.toUpperCase() : null) : null,
      fssai_no: effectiveBusinessType === 'fssai' ? fssaiNo : null,
      trade_license_no: effectiveBusinessType === 'trade_license' ? (tradeLicenseNo ? tradeLicenseNo.toUpperCase() : null) : null,
      terms_accepted: true,
      privacy_accepted: true,
    };

    let { data: profileData, error: profileError } = await adminClient
      .from('merchant_profiles')
      .update(profileUpdate)
      .eq('id', user.id)
      .select()
      .single();

    // Resilience: if the legal_name column hasn't been added yet (migration not
    // applied), don't fail onboarding — retry the save without it.
    if (profileError && /legal_name/i.test(profileError.message || '')) {
      console.warn('[CompleteMerchantProfile] legal_name column missing — saving without it.');
      delete profileUpdate.legal_name;
      ({ data: profileData, error: profileError } = await adminClient
        .from('merchant_profiles')
        .update(profileUpdate)
        .eq('id', user.id)
        .select()
        .single());
    }

    if (profileError) {
      console.error('[CompleteMerchantProfile] Profile update error:', profileError);
      return new Response(JSON.stringify({ error: `Profile update failed: ${profileError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Remove any existing stores for this merchant (handles re-onboarding)
    await adminClient
      .from('merchant_stores')
      .delete()
      .eq('merchant_id', user.id);

    // Insert stores into merchant_stores
    const storeInserts = stores.map((s: any) => ({
      merchant_id:    user.id,
      store_name:     s.store_name || storeName,
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
      console.error('[CompleteMerchantProfile] Store insert error:', storeError);
      return new Response(JSON.stringify({ error: `Store insertion failed: ${storeError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('[CompleteMerchantProfile] Profile completed for:', user.id, 'with', stores.length, 'stores');

    return new Response(JSON.stringify({
      message: 'Merchant profile completed successfully.',
      user: profileData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[CompleteMerchantProfile] Error:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
