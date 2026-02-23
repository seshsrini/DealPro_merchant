// @ts-ignore: Deno global
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';
import { validateInput, validateUsername, validateIndianPhone, validateGSTIN, validatePAN, validateUdyam, validateFSSAI, validateTradeLicense } from '../_shared/validation.ts';
import { applyRateLimit, RateLimitTiers } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Apply strict rate limiting for merchant registration (5 requests per minute)
  const rateLimit = applyRateLimit(req, RateLimitTiers.STRICT);
  if (!rateLimit.allowed) {
    console.warn('[RegisterMerchant] Rate limit exceeded');
    return rateLimit.response!;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(supabaseUrl, anonKey);
  const serviceRoleSupabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Capture payload and validate using shared utilities
    const body = await req.json();

    const validation = validateInput(body, {
      required: ['fullName', 'username', 'email', 'password', 'phone', 'storeName', 'stores'],
      email: 'email',
      // phone validated separately below via validateIndianPhone (supports +91 prefix)
      minLength: { fullName: 1, username: 3, storeName: 1 },
      maxLength: { fullName: 100, username: 30, email: 100, storeName: 100 }
    });

    if (!validation.valid) {
      console.warn('[RegisterMerchant] Validation failed:', validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const {
        fullName, username, email, password, phone, role,
        storeName, category, gstin, pan, stores, languagePreference,
        businessType, udyamNo, fssaiNo, tradeLicenseNo,
        termsAccepted, privacyAccepted
    } = validation.sanitizedData;

    // 2. Additional validations
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return new Response(JSON.stringify({ error: usernameValidation.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const phoneValidation = validateIndianPhone(phone);
    if (!phoneValidation.valid) {
      return new Response(JSON.stringify({ error: phoneValidation.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate business document based on businessType
    const bType = businessType || 'gstin';
    if (bType === 'gstin') {
      if (gstin) {
        const gstinValidation = validateGSTIN(gstin);
        if (!gstinValidation.valid) {
          return new Response(JSON.stringify({ error: gstinValidation.error }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
      }
      if (pan) {
        const panValidation = validatePAN(pan);
        if (!panValidation.valid) {
          return new Response(JSON.stringify({ error: panValidation.error }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
      }
    } else if (bType === 'udyam' && udyamNo) {
      const udyamValidation = validateUdyam(udyamNo);
      if (!udyamValidation.valid) {
        return new Response(JSON.stringify({ error: udyamValidation.error }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    } else if (bType === 'fssai' && fssaiNo) {
      const fssaiValidation = validateFSSAI(fssaiNo);
      if (!fssaiValidation.valid) {
        return new Response(JSON.stringify({ error: fssaiValidation.error }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    } else if (bType === 'trade_license' && tradeLicenseNo) {
      const tradeValidation = validateTradeLicense(tradeLicenseNo);
      if (!tradeValidation.valid) {
        return new Response(JSON.stringify({ error: tradeValidation.error }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }

    // Validate stores array
    if (!Array.isArray(stores) || stores.length === 0) {
      return new Response(JSON.stringify({ error: 'At least one store location is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 3. Sign up with Supabase Auth
    const { data: authData, error: authSignUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      phone: phone,
      options: {
        data: {
          username: username,
          full_name: fullName,
          role: role,
        },
      },
    });

    if (authSignUpError) throw new Error(authSignUpError.message);
    if (!authData.user) throw new Error('User creation failed.');
    
    const userId = authData.user.id;

    // 4. Insert Profile into merchant_profiles
    const { data: profileData, error: profileInsertError } = await serviceRoleSupabase
      .from('merchant_profiles')
      .insert([{
        id: userId,
        username,
        email: cleanEmail,
        phone,
        full_name: fullName,
        role,
        active_status: true,
        store_name: storeName, // The brand name
        category,
        gstin: bType === 'gstin' ? gstin : null,
        pan: bType === 'gstin' ? pan : null,
        business_type: bType,
        udyam_no: bType === 'udyam' ? (udyamNo ? udyamNo.toUpperCase() : null) : null,
        fssai_no: bType === 'fssai' ? fssaiNo : null,
        trade_license_no: bType === 'trade_license' ? (tradeLicenseNo ? tradeLicenseNo.toUpperCase() : null) : null,
        terms_accepted: termsAccepted === true,
        privacy_accepted: privacyAccepted === true,
        lang_preference: languagePreference || 'en', // Default to English if not provided
      }])
      .select()
      .single();

    if (profileInsertError) {
      await serviceRoleSupabase.auth.admin.deleteUser(userId); // Rollback
      throw new Error(`Profile Error: ${profileInsertError.message}`);
    }

    // 5. Insert Stores into merchant_stores
    // FIX: Added s.store_name and locality mapping here
    const storeInserts = stores.map((s: any) => ({
      merchant_id: userId,
      store_name: s.store_name || storeName, // Fallback to brand name if branch name missing
      address: s.address,
      landmark: s.landmark || null,
      locality: s.locality || null, // Add locality field
      city: s.city,
      state: s.state,
      latitude: s.latitude || 0,
      longitude: s.longitude || 0,
      store_hrs: s.store_hrs,
      pincode: s.pincode,
    }));

    const { error: storeError } = await serviceRoleSupabase
      .from('merchant_stores')
      .insert(storeInserts);

    if (storeError) {
      // Extensive Rollback
      await serviceRoleSupabase.from('merchant_profiles').delete().eq('id', userId);
      await serviceRoleSupabase.auth.admin.deleteUser(userId);
      throw new Error(`Store Insertion Error: ${storeError.message}`);
    }

    return new Response(JSON.stringify({
      message: 'Merchant registered successfully.',
      user: profileData,
      session: authData.session || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });

  } catch (error: any) {
    console.error('[Registration Error]:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});