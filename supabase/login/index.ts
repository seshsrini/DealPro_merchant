
// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateInput, sanitizeString } from '../_shared/validation.ts';
import { applyRateLimit, RateLimitTiers } from '../_shared/rateLimiter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper for consistent responses
const createResponse = (payload: any, status: number) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Apply strict rate limiting for login endpoint (5 requests per minute)
  const rateLimit = applyRateLimit(req, RateLimitTiers.STRICT);
  if (!rateLimit.allowed) {
    console.warn('[Login] Rate limit exceeded');
    return rateLimit.response!;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const supabaseAuth = createClient(supabaseUrl, anonKey);

    const body = await req.json();

    // Validate input
    const validation = validateInput(body, {
      required: ['identifier', 'password'],
      minLength: { password: 6 },
      maxLength: { identifier: 100, password: 100 }
    });

    if (!validation.valid) {
      console.warn('[Login] Validation failed:', validation.error);
      return createResponse({ error: validation.error }, 400);
    }

    const identifier = validation.sanitizedData.identifier;
    const password = body.password; // Don't sanitize password

    const normalizedIdentifier = identifier.trim().toLowerCase(); // Normalize input once

    let emailToAuth: string | null = null; // Will store the canonical email for Supabase Auth

    // 1. Find user in `user_profiles` table using normalized identifier
    // Use ilike for username and email for case-insensitive matching.
    // Phone number comparison remains .eq() because phone numbers are typically exact.
    const { data: userProfileRecord, error: profileLookupError } = await adminClient
      .from('user_profiles')
      .select('email')
      .or(`username.ilike.${normalizedIdentifier},email.ilike.${normalizedIdentifier},phone.eq.${identifier}`)
      .maybeSingle();

    if (profileLookupError) {
      console.error('Login: Error looking up user profile by identifier:', profileLookupError);
      return createResponse({ error: 'User lookup failed.' }, 500);
    }

    if (userProfileRecord) {
      emailToAuth = userProfileRecord.email; // Found a profile, get its canonical email
    } else {
      return createResponse({ error: 'User not found' }, 404);
    }

    if (!emailToAuth) {
        return createResponse({ error: 'User found, but no email associated.' }, 500);
    }
    
    // 2. Attempt Authentication with the resolved email (which is already canonical lowercase from DB)
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: emailToAuth, // Use the email retrieved from user_profiles
      password: password,
    });

    if (authError) {
      console.error('Login: Supabase Auth Error:', authError.message);
      return createResponse({ error: authError.message }, 401);
    }
    if (!authData.user || !authData.session) {
      return createResponse({ error: 'Authentication successful but no user/session data returned.' }, 500);
    }

    // 3. Fetch Full Profile from the unified user_profiles table
    const { data: profileData, error: profileError } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      console.error('Login: Error fetching profile from user_profiles:', profileError.message);
      // Clean up auth.users entry if profile is missing (should ideally not happen post-signup)
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return createResponse({ error: 'Profile data incomplete or not found after authentication.' }, 404);
    }

    // 4. Update first_login_at if this is the user's first actual login
    if (!profileData.first_login_at) {
      const { error: updateError } = await adminClient
        .from('user_profiles')
        .update({ first_login_at: new Date().toISOString() })
        .eq('id', authData.user.id);

      if (updateError) {
        console.error('Login: Error updating first_login_at:', updateError.message);
        // Don't fail the login if this update fails, just log it
      } else {
        // Update the profileData to include the new first_login_at value
        profileData.first_login_at = new Date().toISOString();
        console.log(`Login: Set first_login_at for user ${authData.user.id}`);
      }
    }

    // Return the combined user data including the role directly from user_profiles
    return createResponse({
      user: { ...profileData }, // profileData already contains 'role'
      session: authData.session,
    }, 200);

  } catch (err: any) {
    console.error('Login Edge Function Crash:', err.message);
    return createResponse({ error: 'Internal Server Error', details: err.message }, 500);
  }
});