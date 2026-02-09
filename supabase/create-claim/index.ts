
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
export async function authenticateRequest(req: Request, corsHeaders: HeadersInit): Promise<Response | any> { // Using 'any' for User type in EF context for simplicity
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No access token provided.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
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
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  return user;
}
// End of inlined authenticateRequest

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE', // Added PUT, DELETE
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authResult = await authenticateRequest(req, corsHeaders); // Pass corsHeaders
    if (authResult instanceof Response) {
      return authResult; // If it's a Response, return it directly
    }
    const user = authResult; // Otherwise, it's the User object
    // Re-extract the JWT from the incoming request's Authorization header
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${jwt}` }, // Pass the JWT here!
      },
    });

    const { consumerId, merchantId, campaignId, claimNo } = await req.json();

    // 1. Validate Input Data
    if (!isString(consumerId) || consumerId.length < 1) {
      return new Response(JSON.stringify({ error: 'Consumer ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    // Authorization check: consumerId must match the authenticated user's ID
    if (consumerId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Consumer ID mismatch.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (!isString(merchantId) || merchantId.length < 1) {
      return new Response(JSON.stringify({ error: 'Merchant ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(campaignId) || campaignId.length < 1) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(claimNo) || claimNo.length < 1) {
      return new Response(JSON.stringify({ error: 'Claim number is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // 2. Check for existing claim for this consumer and campaign
    const { data: existingClaim, error: checkError } = await supabase
      .from('campaign_interactions')
      .select('interaction_id')
      .eq('consumer_id', consumerId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (checkError) {
      console.error('[redemption/create-claim EF] Supabase check for existing claim failed:', checkError.message);
      throw checkError;
    }

    if (existingClaim) {
      console.warn(`[redemption/create-claim EF] Duplicate claim attempt: Consumer ${consumerId} already has an interaction for Campaign ${campaignId}.`);
      return new Response(JSON.stringify({ error: 'You already have an active or redeemed claim for this campaign.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 409, // Conflict status code
      });
    }

    // 3. Insert new claim if no existing one is found
    const { data, error } = await supabase
      .from('campaign_interactions')
      .insert([
        { 
          consumer_id: consumerId, 
          merchant_id: merchantId, 
          campaign_id: campaignId, 
          claim_no: claimNo, 
          is_redeemed: false, 
          platform: 'mobile' 
        }
      ])
      .select('claim_no')
      .single();

    if (error) {
      console.error('[redemption/create-claim EF] Supabase insert failed:', error.message);

      // Check if it's a unique constraint violation on claim_no
      if (error.message && error.message.includes('campaign_interactions_claim_no_unique')) {
        return new Response(JSON.stringify({
          error: 'CLAIM_NO_DUPLICATE',
          message: 'This claim number is already in use. Please retry with a new claim number.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409, // Conflict
        });
      }

      throw error;
    }

    return new Response(JSON.stringify({ claimNo: data.claim_no, message: 'Claim created successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
  } catch (error: any) {
    console.error('[redemption/create-claim EF] Failed to create claim:', error.message || error);
    let status = 500;
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('Unauthorized') || error.message.includes('Consumer ID mismatch')) {
        status = 401; // Or 403 if specific
      } else if (error.message.includes('Method Not Allowed')) {
        status = 405;
      } else if (error.message.includes('required') || error.message.includes('Invalid')) {
        status = 400; // Bad Request
      } else if (error.message.includes('already have an active or redeemed claim')) { // Specific message from new check
        status = 409;
      } else if (error.message.includes('duplicate key value violates unique constraint')) { // Example for duplicate claim
        // This might still happen if a race condition allows two inserts before the unique constraint is hit.
        // The check above should mostly prevent this, but this is a fallback.
        status = 409;
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});