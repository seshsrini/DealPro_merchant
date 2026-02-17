// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined; };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- 1. HELPER FUNCTIONS (Must be defined before Deno.serve) ---

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function applyRateLimit(req: Request): { allowed: boolean; response?: Response } {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const limit = 5;
  const window = 60000;

  const record = rateLimitMap.get(ip);
  if (record && now < record.resetTime) {
    if (record.count >= limit) {
      return {
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      };
    }
    record.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetTime: now + window });
  }
  return { allowed: true };
}

function validateIndianPhone(phone: string): { valid: boolean; error?: string } {
  const cleanPhone = phone.replace(/\D/g, '');
  let phoneDigits = cleanPhone;
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    phoneDigits = cleanPhone.substring(2);
  } else if (cleanPhone.length === 10) {
    phoneDigits = cleanPhone;
  } else {
    return { valid: false, error: 'Phone number must be 10 digits' };
  }
  if (!/^[6-9][0-9]{9}$/.test(phoneDigits)) {
    return { valid: false, error: 'Invalid Indian phone number' };
  }
  return { valid: true };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- 2. MAIN HANDLER ---

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Apply Rate Limit
  const rateLimit = applyRateLimit(req);
  if (!rateLimit.allowed) return rateLimit.response!;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    let { fullName, username, phone, password, role, home_location, languagePreference } = body;

    console.log('[RegisterUser] Request received:', { phone, username, role, home_location, languagePreference });

    // Normalize Phone
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length === 10) phone = `+91${cleanPhone}`;
      else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) phone = `+${cleanPhone}`;

      const phoneVal = validateIndianPhone(phone);
      if (!phoneVal.valid) throw new Error(phoneVal.error);
    }

    // Check for duplicate phone number
    const { data: existingUser, error: checkError } = await adminClient
      .from('user_profiles')
      .select('phone')
      .eq('phone', phone)
      .maybeSingle();

    if (checkError) throw new Error('Failed to check phone availability');
    if (existingUser) throw new Error('Phone number already registered');

    console.log('[RegisterUser] Phone validated as unique:', phone);

    // Check for duplicate username if provided
    if (username) {
      const { data: existingUsername, error: usernameCheckError } = await adminClient
        .from('user_profiles')
        .select('username')
        .ilike('username', username)
        .maybeSingle();

      if (usernameCheckError) throw new Error('Failed to check username availability');
      if (existingUsername) throw new Error('Username already taken');

      console.log('[RegisterUser] Username validated as unique:', username);
    }

    // Generate email for Supabase Auth (phone without + and @)
    const phoneForEmail = phone.replace(/\+/g, '').replace(/\s/g, '');
    const generatedEmail = `${phoneForEmail}@internal.dealpro.app`;

    // Auth Signup via Admin API with generated email
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: generatedEmail,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { role, full_name: fullName, phone: phone }
    });

    if (authError) throw new Error(authError.message);

    console.log('[RegisterUser] Auth user created:', authData.user.id);

    // Profile Insert (store generated email for login purposes)
    const { data: profileData, error: profileError } = await adminClient
      .from('user_profiles')
      .insert([{
        id: authData.user.id,
        phone: phone,
        username: username || null,
        email: generatedEmail, // Store generated email
        full_name: fullName || null,
        role: role || 'consumer',
        active_status: true,
        home_location: home_location || null,
        lang_preference: languagePreference || 'en'
      }])
      .select()
      .single();

    if (profileError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      throw new Error(profileError.message);
    }

    console.log('[RegisterUser] Profile created successfully for:', phone);

    return new Response(JSON.stringify({ success: true, user: profileData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201
    });

  } catch (error: any) {
    console.error('[RegisterUser] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
