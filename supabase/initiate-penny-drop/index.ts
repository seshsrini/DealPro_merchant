
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

export function isString(value: any): boolean {
  return typeof value === 'string';
}

// Inlined content of authenticateRequest
export async function authenticateRequest(req: Request, corsHeaders: HeadersInit): Promise<Response | any> {
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
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// PennyDropStatus enum (replicated for EF context)
type PennyDropStatus = 'not_initiated' | 'initiated' | 'verified' | 'failed';

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const user = await authenticateRequest(req, corsHeaders);
    if (user instanceof Response) return user;

    // Use service role client for direct database updates without RLS checks
    const serviceRoleSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Robust staff lockout: block a suspended/removed staff member (false only when
    // the user has staff rows but none active). Fail-open on null.
    const { data: __actorOk } = await serviceRoleSupabase.rpc('merchant_is_active_actor', { p_user_id: (user as any).id });
    if (__actorOk === false) {
      return new Response(JSON.stringify({ success: false, error: 'ACCESS_DISABLED', message: 'Your access has been disabled by the store owner.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    const { merchantId, encryptedAccountNumber, ifscCode, bankName, branchName, accountType } = await req.json();

    // 1. Validate Input Data
    if (!isString(merchantId) || !isValidUUID(merchantId)) {
      return new Response(JSON.stringify({ success: false, message: 'Valid Merchant ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    // Authorization check
    if (merchantId !== user.id) {
      return new Response(JSON.stringify({ success: false, message: 'Unauthorized: Merchant ID mismatch.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (!isString(encryptedAccountNumber) || encryptedAccountNumber.length < 1) {
      return new Response(JSON.stringify({ success: false, message: 'Encrypted account number is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(ifscCode) || ifscCode.length !== 11) { // Basic IFSC length check
      return new Response(JSON.stringify({ success: false, message: 'Valid IFSC Code is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(bankName) || bankName.length < 1 || !isString(branchName) || branchName.length < 1) {
      return new Response(JSON.stringify({ success: false, message: 'Bank Name and Branch Name are required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!['savings', 'current', 'other'].includes(accountType)) {
      return new Response(JSON.stringify({ success: false, message: 'Valid Account Type is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Simulate Penny Drop Logic
    // In a real scenario, this would involve an actual API call to a payment gateway
    // or banking service to deposit ₹1 and confirm account validity.
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
    const pennyDropSuccess = Math.random() > 0.1; // 90% chance of success for demo

    let newPennyDropStatus: PennyDropStatus;
    let message: string;

    if (pennyDropSuccess) {
      newPennyDropStatus = 'verified'; // Simulate immediate verification
      message = 'Penny drop successful! Account verified.';
    } else {
      newPennyDropStatus = 'failed';
      message = 'Penny drop failed. Please check account details or try again later.';
    }

    // Update merchant's profile with bank details and penny drop status
    const { error: updateError } = await serviceRoleSupabase
      .from('user_profiles')
      .update({
        ifsc_code: ifscCode,
        bank_name: bankName,
        branch_name: branchName,
        account_number_encrypted: encryptedAccountNumber, // Store encrypted
        account_type: accountType,
        penny_drop_status: newPennyDropStatus,
      })
      .eq('id', merchantId);

    if (updateError) {
      console.error('[payment/initiate-penny-drop EF] Supabase update failed:', updateError.message);
      throw updateError;
    }

    return new Response(JSON.stringify({ success: pennyDropSuccess, message, status: newPennyDropStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[payment/initiate-penny-drop EF] Failed to initiate penny drop:', error.message);
    let status = 500;
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('Unauthorized')) {
        status = 401;
      } else if (error.message.includes('Method Not Allowed')) {
        status = 405;
      } else if (error.message.includes('required') || error.message.includes('Valid')) {
        status = 400; // Bad Request
      }
    }
    return new Response(JSON.stringify({ success: false, message: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});