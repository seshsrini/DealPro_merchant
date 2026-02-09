
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Simplified methods
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
};

Deno.serve(async (req) => {
  // 1. MUST handle OPTIONS for browser preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') { // Using POST to get merchantId in body
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
      return authResult;
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

    const { merchantId } = await req.json();

    // 1. Validate Input Data
    if (!isString(merchantId) || merchantId.length < 1) {
      return new Response(JSON.stringify({ error: 'Merchant ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    // Authorization check
    if (merchantId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Cannot access analytics for another merchant.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    
    let totalLifetimeDeals = 0;
    let totalLifetimeClicks = 0;
    let totalLifetimeRedemptions = 0;
    let totalInvitesSent = 0;
    let totalInvitesAccepted = 0;

    // Total Lifetime Deals
    const { count: dealsCount, error: dealsError } = await supabase
      .from('campaigns')
      .select('campaign_id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);
    if (dealsError) console.error(`[merchant-dashboard/get-lifetime-analytics EF] Supabase error fetching totalLifetimeDeals for ${merchantId}:`, dealsError.message);
    else totalLifetimeDeals = dealsCount || 0;

    // Total Lifetime Clicks
    const { count: clicksCount, error: clicksError } = await supabase
      .from('user_activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('event_type', 'click');
    if (clicksError) console.error(`[merchant-dashboard/get-lifetime-analytics EF] Supabase error fetching totalLifetimeClicks for ${merchantId}:`, clicksError.message);
    else totalLifetimeClicks = clicksCount || 0;

    // Total Lifetime Redemptions - MODIFIED TO COUNT ALL INTERACTIONS
    const { count: redemptionsCount, error: redemptionsError } = await supabase
      .from('campaign_interactions')
      .select('*', { count: 'exact', head: true }) // Using '*' for robustness
      .eq('merchant_id', merchantId); // Removed .eq('is_redeemed', true)
    if (redemptionsError) console.error(`[merchant-dashboard/get-lifetime-analytics EF] Supabase error fetching totalLifetimeRedemptions for ${merchantId}:`, redemptionsError.message);
    else totalLifetimeRedemptions = redemptionsCount || 0;

    // Calculate Lifetime Conversion Rate
    const lifetimeConversionRate = totalLifetimeClicks > 0
      ? ((totalLifetimeRedemptions / totalLifetimeClicks) * 100).toFixed(1) + '%'
      : '0%';

    // Total Invites Sent
    const { count: invitesSentCount, error: invitesSentError } = await supabase
      .from('merchant_invites')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', merchantId);
    if (invitesSentError) console.error(`[merchant-dashboard/get-lifetime-analytics EF] Supabase error fetching totalInvitesSent for ${merchantId}:`, invitesSentError.message);
    else totalInvitesSent = invitesSentCount || 0;

    // Total Invites Accepted (Qualified Referrals)
    const { count: invitesAcceptedCount, error: invitesAcceptedError } = await supabase
      .from('merchant_referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', merchantId)
      .eq('status', 'qualified'); // Assuming 'qualified' means accepted/converted
    if (invitesAcceptedError) console.error(`[merchant-dashboard/get-lifetime-analytics EF] Supabase error fetching totalInvitesAccepted for ${merchantId}:`, invitesAcceptedError.message);
    else totalInvitesAccepted = invitesAcceptedCount || 0;

    const result = {
      totalLifetimeDeals: totalLifetimeDeals,
      totalLifetimeClicks: totalLifetimeClicks,
      totalLifetimeRedemptions: totalLifetimeRedemptions,
      lifetimeConversionRate: lifetimeConversionRate,
      totalInvitesSent: totalInvitesSent,
      totalInvitesAccepted: totalInvitesAccepted,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('[merchant-dashboard/get-lifetime-analytics EF] Failed to fetch merchant lifetime analytics:', error.message || error);
    let status = 500;
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('Unauthorized')) {
        status = 401;
      } else if (error.message.includes('Method Not Allowed')) {
        status = 405;
      } else if (error.message.includes('Merchant ID is required')) {
        status = 400; // Bad Request
      }
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});
