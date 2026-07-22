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
      // Authoritative "signup fully finished" flag — the app gate reads this.
      onboarding_complete: true,
    };

    // NOTE: .select() WITHOUT .single(). The old .single() threw PGRST116 ("0 rows")
    // when no merchant_profiles row existed — which happens when a merchant came in
    // through the register-user fallback (that writes user_profiles, not
    // merchant_profiles). With plain .select(), zero rows is an empty array, not an
    // error, so we can detect it and insert instead of 500-ing.
    let { data: updatedRows, error: profileError } = await adminClient
      .from('merchant_profiles')
      .update(profileUpdate)
      .eq('id', user.id)
      .select();

    // Resilience: if a newer column hasn't been added yet (migration not applied),
    // don't fail onboarding — strip the offending column and retry. Handles both
    // legal_name and onboarding_complete; the regex only matches those names, so
    // once they're gone any other error breaks the loop.
    while (profileError && /(legal_name|onboarding_complete)/i.test(profileError.message || '')) {
      const missing = /onboarding_complete/i.test(profileError.message || '') ? 'onboarding_complete' : 'legal_name';
      console.warn(`[CompleteMerchantProfile] ${missing} column missing — saving without it.`);
      delete profileUpdate[missing];
      ({ data: updatedRows, error: profileError } = await adminClient
        .from('merchant_profiles')
        .update(profileUpdate)
        .eq('id', user.id)
        .select());
    }

    if (profileError) {
      console.error('[CompleteMerchantProfile] Profile update error:', profileError);
      return new Response(JSON.stringify({ error: `Profile update failed: ${profileError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let profileData: any = updatedRows && updatedRows.length > 0 ? updatedRows[0] : null;

    // No row was updated → none existed for this user. Create it, so the merchant
    // isn't stuck on a 500 at the final step. phone + role are the only extra NOT
    // NULL identity columns; referral codes are nullable (register-merchant's
    // working insert omits them). phone comes off the authenticated user —
    // login-merchant stores it in user_metadata and bakes it into the internal email.
    if (!profileData) {
      const meta = (user.user_metadata || {}) as Record<string, any>;
      const emailDigits = (user.email || '').split('@')[0].replace(/\D/g, '');
      const phone = meta.phone || (user as any).phone || (emailDigits ? emailDigits.slice(-10) : '');
      const insertRow: Record<string, unknown> = {
        id: user.id, phone, role: 'merchant', active_status: true, ...profileUpdate,
      };
      console.log('[CompleteMerchantProfile] No merchant_profiles row — inserting one for:', user.id);
      let { data: insertedRows, error: insertError } = await adminClient
        .from('merchant_profiles')
        .insert(insertRow)
        .select();
      // Same not-yet-migrated-column resilience on the insert path.
      while (insertError && /(legal_name|onboarding_complete)/i.test(insertError.message || '')) {
        const missing = /onboarding_complete/i.test(insertError.message || '') ? 'onboarding_complete' : 'legal_name';
        console.warn(`[CompleteMerchantProfile] ${missing} column missing on insert — omitting.`);
        delete insertRow[missing];
        ({ data: insertedRows, error: insertError } = await adminClient
          .from('merchant_profiles')
          .insert(insertRow)
          .select());
      }
      if (insertError) {
        console.error('[CompleteMerchantProfile] Profile insert error:', insertError);
        return new Response(JSON.stringify({ error: `Profile create failed: ${insertError.message}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      profileData = insertedRows && insertedRows[0];
    }

    // Remove any existing stores for this merchant (handles re-onboarding)
    await adminClient
      .from('merchant_stores')
      .delete()
      .eq('merchant_id', user.id);

    // Insert stores into merchant_stores. Base columns match register-merchant's
    // proven-working insert; the extended ones sit on top.
    const baseStore = (s: any) => ({
      merchant_id:    user.id,
      store_name:     s.store_name || storeName,
      address:        s.address,
      landmark:       s.landmark       || null,
      locality:       s.locality       || null,
      city:           s.city,
      state:          s.state,
      latitude:       s.latitude       || 0,
      longitude:      s.longitude      || 0,
      store_hrs:      s.store_hrs,
      pincode:        s.pincode,
    });
    const extendedStore = (s: any) => ({
      ...baseStore(s),
      store_category: s.store_category || null,
      store_phone:    s.store_phone    || null,
      store_phone_alt: s.store_phone_alt || null,
      delivers:       s.delivers       || false,
      delivery_radius_km: s.delivers ? (s.delivery_radius_km || null) : null,
    });

    let { error: storeError } = await adminClient
      .from('merchant_stores')
      .insert(stores.map(extendedStore));

    // Same not-yet-migrated-column resilience as the profile write: if an extended
    // column is missing (PGRST204), retry with just the base columns rather than
    // fail signup. Delivery/phone can be set later from the store editor.
    const missingColumn = storeError && (
      storeError.code === 'PGRST204' ||
      /could not find|does not exist/i.test(storeError.message || '')
    );
    if (missingColumn) {
      console.warn('[CompleteMerchantProfile] Extended store columns absent, retrying with base columns:', storeError.message);
      ({ error: storeError } = await adminClient
        .from('merchant_stores')
        .insert(stores.map(baseStore)));
    }

    if (storeError) {
      console.error('[CompleteMerchantProfile] Store insert error:', storeError);
      return new Response(JSON.stringify({ error: `Store insertion failed: ${storeError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('[CompleteMerchantProfile] Profile completed for:', user.id, 'with', stores.length, 'stores');

    // Crowd-source the pincode directory: if a merchant typed a locality that
    // isn't an official India Post post-office for their pincode (e.g. a colony /
    // neighbourhood name like "Basava Nagar"), contribute it so future signups AND
    // consumers see it as an autocomplete option. Best-effort — never blocks or
    // fails the profile completion.
    try {
      const seen = new Set<string>();
      for (const s of stores) {
        const pincode = String(s.pincode || '').trim();
        const locality = String(s.locality || '').trim();
        if (!/^\d{6}$/.test(pincode) || locality.length < 2) continue;
        const key = `${pincode}|${locality.toLowerCase()}`;
        if (seen.has(key)) continue; // dedupe within this submit
        seen.add(key);

        // Skip if this (pincode, locality) already exists (case-insensitive) —
        // whether from the India Post import or a previous merchant.
        const { data: existing } = await adminClient
          .from('pincode_directory')
          .select('id')
          .eq('pincode', pincode)
          .ilike('locality', locality)
          .limit(1)
          .maybeSingle();
        if (existing) continue;

        const { error: dirErr } = await adminClient.from('pincode_directory').insert({
          pincode,
          locality,
          city: s.city || null,
          state: s.state || null,
          source: 'merchant',
          merchant_id: user.id,
        });
        if (dirErr) {
          console.warn('[CompleteMerchantProfile] directory contribute failed:', dirErr.message);
        } else {
          console.log(`[CompleteMerchantProfile] Contributed locality to directory: ${pincode} / ${locality}`);
        }
      }
    } catch (e: any) {
      console.warn('[CompleteMerchantProfile] Pincode directory enrichment skipped (non-blocking):', e?.message);
    }

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
