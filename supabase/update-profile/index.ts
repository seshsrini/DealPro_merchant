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

// Inlined content of authenticateRequest
export async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not set.');
  }

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) {
    throw new Error('Unauthorized: No access token provided.');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);

  if (error || !user) {
    console.error('[authenticateRequest] JWT authentication failed:', error?.message);
    throw new Error('Unauthorized: Invalid or expired token.');
  }

  return user;
}
// End of inlined authenticateRequest

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Simplified methods
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
};

Deno.serve(async (req) => {
  // 1. MUST HAVE THIS FOR EVERY FUNCTION
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service role for admin operations
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!; // For authenticateRequest

  const serviceRoleSupabase = createClient(supabaseUrl, serviceRoleKey); // Service role client

  try {
    const authenticatedUser = await authenticateRequest(req);

    const { id, role, data } = await req.json(); // role is passed for context, though no longer used for table selection

    // 1. Validate Input Data
    if (!isString(id) || id.length < 1) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    // Authorization check: Ensure the ID in the payload matches the authenticated user's ID
    if (id !== authenticatedUser.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Cannot update another user\'s profile.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (!isString(role) || !['consumer', 'merchant'].includes(role)) { // Validate provided role
      return new Response(JSON.stringify({ error: 'Invalid user role provided.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isObject(data)) {
      return new Response(JSON.stringify({ error: 'Invalid data payload.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    let authUpdatePayload: any = { data: {} }; // Initialize data object for user_metadata updates
    let profileUpdatePayload: any = {};

    // Prepare data for auth.users table (managed by adminClient)
    if (data.email && isValidEmail(data.email) && data.email !== authenticatedUser.email) {
      authUpdatePayload.email = data.email;
    }
    if (data.phone && isValidPhoneNumber(data.phone) && data.phone !== authenticatedUser.phone) {
      authUpdatePayload.phone = data.phone;
    }
    if (data.password && isValidPassword(data.password)) {
      authUpdatePayload.password = data.password;
    }
    // Update username in auth.users user_metadata for consistency
    if (data.username && isString(data.username) && data.username !== authenticatedUser.user_metadata?.username) {
      authUpdatePayload.data.username = data.username;
    }
    // Update full_name in auth.users user_metadata for consistency
    if (data.full_name && isString(data.full_name) && data.full_name !== authenticatedUser.user_metadata?.full_name) {
      authUpdatePayload.data.full_name = data.full_name;
    }
    // If no specific metadata updates, ensure authUpdatePayload.data is not an empty object
    if (Object.keys(authUpdatePayload.data).length === 0) {
      delete authUpdatePayload.data;
    }


    // Prepare data for custom user_profiles table
    if (data.full_name && isString(data.full_name)) {
      profileUpdatePayload.full_name = data.full_name;
    }
    if (data.username && isString(data.username)) {
      profileUpdatePayload.username = data.username;
    }
    if (data.email && isValidEmail(data.email)) {
      profileUpdatePayload.email = data.email;
    }
    if (data.phone && isValidPhoneNumber(data.phone)) {
      profileUpdatePayload.phone = data.phone;
    }

    // Merchant-specific fields (only if the user is a merchant)
    if (role === 'merchant') {
      if (data.store_name && isString(data.store_name)) {
        profileUpdatePayload.store_name = data.store_name;
      }
      if (data.category && isString(data.category)) {
        profileUpdatePayload.category = data.category;
      }
      if (data.gstin && isString(data.gstin)) {
        profileUpdatePayload.gstin = data.gstin;
      }
      if (data.pan && isString(data.pan)) {
        profileUpdatePayload.pan = data.pan;
      }
    }

    // Preference fields (applicable to all roles)
    if (data.lang_preference && isString(data.lang_preference)) {
      profileUpdatePayload.lang_preference = data.lang_preference;
    }
    if (typeof data.push_notification === 'boolean') {
      profileUpdatePayload.push_notification = data.push_notification;
    }
    if (typeof data.email_notification === 'boolean') {
      profileUpdatePayload.email_notification = data.email_notification;
    }
    if (typeof data.text_notification === 'boolean') {
      profileUpdatePayload.text_notification = data.text_notification;
    }

    // Perform update on auth.users table if there's anything to update
    if (Object.keys(authUpdatePayload).length > 0) {
      const { error: authError } = await serviceRoleSupabase.auth.admin.updateUserById(id, authUpdatePayload);
      if (authError) {
        console.error('[user/update-profile EF] Supabase Auth update failed:', authError.message);
        throw authError;
      }
    }

    // Perform update on the correct profile table based on role
    const profileTable = (role === 'merchant' || role === 'dealadmin')
      ? 'merchant_profiles'
      : 'user_profiles';
    if (Object.keys(profileUpdatePayload).length > 0) {
      const { error: profileError } = await serviceRoleSupabase
        .from(profileTable)
        .update(profileUpdatePayload)
        .eq('id', id);

      if (profileError) {
        console.error(`[user/update-profile EF] ${profileTable} update failed:`, profileError.message);
        throw profileError;
      }
    }

    return new Response(JSON.stringify({ message: 'Profile updated successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[user/update-profile EF] Failed to update user profile:', error.message || error);
    let status = 500;
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('Unauthorized')) {
        status = 401;
      } else if (error.message.includes('Method Not Allowed')) {
        status = 405;
      } else if (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('duplicate key value')) {
        status = 400; // Bad Request
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});