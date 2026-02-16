// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateInput, validatePassword, validateUsername, validateIndianPhone } from '../_shared/validation.ts';
import { applyRateLimit, RateLimitTiers } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Simplified methods
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  // Apply strict rate limiting for registration (5 requests per minute)
  const rateLimit = applyRateLimit(req, RateLimitTiers.STRICT);
  if (!rateLimit.allowed) {
    console.warn('[RegisterUser] Rate limit exceeded');
    return rateLimit.response!;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const adminClient = createClient(supabaseUrl, serviceKey);
  const supabase = createClient(supabaseUrl, anonKey); // Client for auth.signUp

  try {
    const body = await req.json();

    // 1. Validate input using shared validation utilities
    const validation = validateInput(body, {
      required: ['username', 'email', 'password'],
      email: 'email',
      minLength: { username: 3, fullName: 1 },
      maxLength: { username: 30, fullName: 100, email: 100 }
    });

    if (!validation.valid) {
      console.warn('[RegisterUser] Validation failed:', validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { fullName, username, email, password, phone, role, languagePreference, home_location } = validation.sanitizedData;

    // Validate username format
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return new Response(JSON.stringify({ error: usernameValidation.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return new Response(JSON.stringify({ error: passwordValidation.error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate phone if provided
    if (phone) {
      const phoneValidation = validateIndianPhone(phone);
      if (!phoneValidation.valid) {
        return new Response(JSON.stringify({ error: phoneValidation.error }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
    }

    // Validate role
    if (role !== 'consumer') {
      return new Response(JSON.stringify({ error: 'Invalid role for this registration. Must be "consumer".' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Duplicate Check in user_profiles
    const { data: existingProfile, error: profileCheckError } = await adminClient
      .from('user_profiles')
      .select('username, email, phone')
      .or(`username.ilike.${username},email.eq.${cleanEmail}${phone ? `,phone.eq.${phone}` : ''}`) // Conditionally check phone
      .maybeSingle();

    if (profileCheckError) throw profileCheckError;
    if (existingProfile) {
      if (existingProfile.username?.toLowerCase() === username.toLowerCase()) throw new Error('Username already exists.');
      if (existingProfile.email === cleanEmail) throw new Error('Email already registered.');
      if (phone && existingProfile.phone === phone) throw new Error('Phone number already registered.'); // Conditionally check phone
    }

    // 3. Create User in Supabase Auth
    // Use the anon key client for signUp to trigger email verification flow if enabled
    const authOptions: { email: string; password?: string; phone?: string; options?: { data?: any } } = {
      email: cleanEmail,
      password: password,
      options: {
        data: {
          username: username,
          full_name: fullName || null, // Store full_name as null if not provided
          role: role,
        },
      },
    };
    if (phone) { // Only add phone if provided by user
      authOptions.phone = phone;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp(authOptions);

    if (authError) {
      console.error('Supabase Auth Sign-Up Failed:', authError.message);
      throw new Error(authError.message || 'Registration failed in Auth.');
    }
    const user = authData.user;

    // 4. Insert Profile Data into unified user_profiles table
    const userProfilePayload = {
      id: user!.id, // Use the ID from auth.users
      username: username,
      email: cleanEmail,
      phone: phone || null, // Store phone as null if not provided
      full_name: fullName || null, // Store full_name as null if not provided
      role: role,
      category: 'consumer', // Added as per new requirement
      active_status: true,
      lang_preference: languagePreference || 'en', // Default to English if not provided
      home_location: home_location || null, // Add consumer home location
    };

    const { data: profileData, error: profileInsertError } = await adminClient
      .from('user_profiles')
      .insert([userProfilePayload])
      .select('*')
      .single();

    if (profileInsertError) {
      console.error('Consumer profile insertion failed, attempting to delete auth user:', profileInsertError.message);
      await adminClient.auth.admin.deleteUser(user!.id); // Rollback auth user
      throw new Error(`Profile Error: ${profileInsertError.message}`);
    }

    // 5. Return Response (session might be null if email verification is pending)
    return new Response(JSON.stringify({
      message: 'Registration successful.',
      user: profileData, // Return the full user_profiles object
      session: authData.session || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: authData.session ? 201 : 202, // 201 Created, 202 Accepted (for pending verification)
    });

  } catch (error: any) {
    console.error('Register Consumer Edge Function Crash:', error.message);
    let status = 400;
    if (typeof error.message === 'string') {
      if (error.message.includes('already exists') || error.message.includes('duplicate key value')) {
        status = 409; // Conflict
      } else if (error.message.includes('Auth')) {
        status = 401; // Unauthorized due to auth error
      } else if (error.message.includes('Error')) { // General profile or store error
        status = 500;
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});