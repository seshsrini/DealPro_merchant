// @ts-ignore: Deno global
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

const validate = {
  isValidEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  isValidPhoneNumber: (phone: string) => /^\+?[1-9]\d{1,14}(?:[-\s]\d+)*$/.test(phone),
  isValidPassword: (pw: string) => /^(?=.*[A-Z])(?=.*\d)[^\s]{8,15}$/.test(pw),
  isValidUsername: (un: string) => /^[a-zA-Z0-9_.-]{3,20}$/.test(un),
  isString: (value: any): boolean => typeof value === 'string',
  isArray: (value: any): boolean => Array.isArray(value),
  isObject: (value: any): boolean => typeof value === 'object' && value !== null,
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(supabaseUrl, anonKey);
  const serviceRoleSupabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Capture payload into a variable so it can be reused safely
    const body = await req.json();
    const {
        fullName, username, email, password, phone, role,
        storeName, category, gstin, pan, stores, languagePreference
    } = body;

    // 2. Comprehensive Validation
    if (!validate.isString(fullName)) throw new Error('Full name is required.');
    if (!validate.isValidUsername(username)) throw new Error('Username invalid (3-20 chars).');
    if (!validate.isValidEmail(email)) throw new Error('Invalid email format.');
    if (!validate.isValidPassword(password)) throw new Error('Password must have 1 Uppercase, 1 Number, 8-15 chars.');
    if (!validate.isValidPhoneNumber(phone)) throw new Error('Invalid phone format.');
    if (!validate.isString(storeName)) throw new Error('Brand store name is required.');
    if (!validate.isArray(stores) || stores.length === 0) throw new Error('At least one store location is required.');

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

    // 4. Insert Profile into user_profiles
    const { data: profileData, error: profileInsertError } = await serviceRoleSupabase
      .from('user_profiles')
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
        gstin,
        pan,
        first_login_at: new Date().toISOString(),
        lang_preference: languagePreference || 'en', // Default to English if not provided
      }])
      .select()
      .single();

    if (profileInsertError) {
      await serviceRoleSupabase.auth.admin.deleteUser(userId); // Rollback
      throw new Error(`Profile Error: ${profileInsertError.message}`);
    }

    // 5. Insert Stores into merchant_stores
    // FIX: Added s.store_name mapping here
    const storeInserts = stores.map((s: any) => ({
      merchant_id: userId,
      store_name: s.store_name || storeName, // Fallback to brand name if branch name missing
      address: s.address,
      landmark: s.landmark || null,
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
      await serviceRoleSupabase.from('user_profiles').delete().eq('id', userId);
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