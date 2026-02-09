
// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';
// Inlined content of validation.ts
export function isValidUUID(uuid: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  const regex = /^\+[1-9]\d{1,14}$/; // E.g., +919999999999
  return regex.test(phone);
}

export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && value >= 0;
}

export function isString(value: any): boolean {
  return typeof value === 'string';
}

export function isBoolean(value: any): boolean {
  return typeof value === 'boolean';
}

export function isObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: any): boolean {
  return Array.isArray(value);
}

export function isDateString(value: string): boolean {
  return !isNaN(new Date(value).getTime());
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, at most 15, one uppercase, one number, and no spaces.
  const regex = /^(?=.*[A-Z])(?=.*\d)[^\s]{8,15}$/;
  return regex.test(password);
}
// End of inlined validation.ts

// Removed encryptionUtils import as passwords are now handled by Supabase Auth

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
};

Deno.serve(async (req) => {
  // 1. MUST handle OPTIONS for browser preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Supabase client with service role key for admin operations
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { identifier, newPassword } = await req.json();

    // 1. Validate Input Data
    if (!isString(identifier) || identifier.length < 1) {
      return new Response(JSON.stringify({ error: 'Identifier is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(newPassword) || !isValidPassword(newPassword)) {
      return new Response(JSON.stringify({ error: 'Invalid password: must be 8-15 characters, contain one uppercase, one number, and no spaces.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    let authUserId: string | null = null;

    // Determine identifier type and find auth.users.id from user_profiles
    // First, try to find by email or phone directly in auth.users as admin
    if (isValidEmail(identifier)) {
      const { data, error } = await adminSupabase.auth.admin.listUsers({ email: identifier });
      if (error) console.error('[reset-password EF] Error listing users by email:', error.message);
      if (data?.users?.length > 0) authUserId = data.users[0].id;
    } else if (isValidPhoneNumber(identifier)) {
      const { data, error } = await adminSupabase.auth.admin.listUsers({ phone: identifier });
      if (error) console.error('[reset-password EF] Error listing users by phone:', error.message);
      if (data?.users?.length > 0) authUserId = data.users[0].id;
    } else {
      // Assume it's a username, find associated user_profiles.id
      const { data: userProfile, error: profileLookupError } = await adminSupabase
        .from('user_profiles')
        .select('id')
        .ilike('username', identifier)
        .maybeSingle();

      if (profileLookupError) {
        console.error('[reset-password EF] Error looking up user profile by username:', profileLookupError.message);
        throw profileLookupError; // Re-throw to be caught by outer catch block
      }
      if (userProfile) {
        authUserId = userProfile.id;
      }
    }

    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'User not found for the given identifier.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }

    // 2. Update password in Supabase Auth
    const { data: updateAuthData, error: updateAuthError } = await adminSupabase.auth.admin.updateUserById(
      authUserId,
      { password: newPassword }
    );

    if (updateAuthError) {
      console.error('[reset-password EF] Supabase Auth Password Update Failed:', updateAuthError.message);
      // Corrected to use updateAuthError.message directly
      throw new Error(updateAuthError.message || 'Failed to reset password in authentication system.');
    }

    return new Response(JSON.stringify({ message: 'Password reset successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[reset-password EF] Password reset failed:', error.message || error);
    let status = 500;
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('User not found')) {
        status = 404;
      } else if (error.message.includes('Invalid password')) {
        status = 400;
      } else if (error.message.includes('authentication system')) { // Specific message from throw
        status = 500;
      } else if (error.message.includes('looking up user profile by username')) { // Specific error from profile lookup
        status = 500;
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});