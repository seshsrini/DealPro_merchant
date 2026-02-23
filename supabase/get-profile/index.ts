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
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authenticatedUser = await authenticateRequest(req);
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

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

    const { userId } = await req.json(); // Only userId is needed now, role is on the profile

    // 1. Validate Input Data
    if (!isString(userId) || !isValidUUID(userId)) {
      return new Response(JSON.stringify({ error: 'Valid User ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Authorization check: Ensure the userId in the payload matches the authenticated user's ID
    if (userId !== authenticatedUser.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Cannot access another user\'s profile.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    // Determine table from auth user metadata (set at registration time)
    const userRole = authenticatedUser.user_metadata?.role || 'consumer';
    const profileTable = (userRole === 'merchant' || userRole === 'dealadmin')
      ? 'merchant_profiles'
      : 'user_profiles';

    const { data: profileData, error: profileError } = await supabase
      .from(profileTable)
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error(`[user/get-profile EF] Error fetching profile from ${profileTable}:`, profileError.message);
      return new Response(JSON.stringify({ error: 'Profile data incomplete or not found.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }

    return new Response(JSON.stringify({ ...profileData }), { // profileData already contains 'role'
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[user/get-profile EF] Failed to get user profile:', error.message || error);
    let status = 500;
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('Unauthorized')) {
        status = 401;
      } else if (error.message.includes('Method Not Allowed')) {
        status = 405;
      } else if (error.message.includes('required') || error.message.includes('Invalid')) {
        status = 400; // Bad Request
      } else if (error.message.includes('not found')) {
        status = 404;
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});