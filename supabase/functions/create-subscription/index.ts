// supabase/functions/create-subscription
// -----------------------------------------------------------------------------
// POST { tier_key: string, merchant_id: string, loyalty?: boolean }
//
// Looks up the tier in subscription_tiers, creates a Razorpay subscription
// against that tier's razorpay_plan_id, and returns { subscription_id }. The
// merchant app then opens Razorpay Checkout in-app with that subscription_id.
//
// Replaces the Next.js route /api/razorpay/create-subscription on VedicJaalam
// so the subscription flow no longer depends on Vercel. Same Razorpay REST
// call, same Supabase lookup — just running inside Supabase Edge Functions
// against the same SUPABASE_URL / RAZORPAY_KEY_* env vars.
//
// Auth: requires a valid merchant Bearer token (the merchant app already sends
// it on supabase.functions.invoke). The Next.js route trusted merchant_id from
// the URL — we explicitly verify it here.
// -----------------------------------------------------------------------------

// @ts-ignore — Deno globals not visible to TS in this repo's tsconfig
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function basicAuthHeader(): string {
  const id = Deno.env.get('RAZORPAY_KEY_ID');
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!id || !secret) {
    throw new Error('Razorpay keys not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');
  }
  return 'Basic ' + btoa(`${id}:${secret}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // ---- Auth: verify the caller is a logged-in merchant ----------------------
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized: missing token' }, 401);
  }
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized: invalid token' }, 401);
  }

  // ---- Parse body -----------------------------------------------------------
  let body: { tier_key?: string; merchant_id?: string; loyalty?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const { tier_key, merchant_id, loyalty } = body;
  if (!tier_key || !merchant_id) {
    return jsonResponse({ error: 'tier_key and merchant_id are required' }, 400);
  }

  // The caller can only buy a subscription for themselves. Belt-and-braces
  // against a tampered merchant_id in the body.
  if (merchant_id !== user.id) {
    return jsonResponse({ error: 'merchant_id does not match the authenticated user' }, 403);
  }

  // ---- Tier lookup ----------------------------------------------------------
  const { data: tier, error: tierErr } = await supabaseAdmin
    .from('subscription_tiers')
    .select('id, tier_key, tier_name, subscription_fee, billing_frequency, razorpay_plan_id, is_active')
    .eq('tier_key', tier_key)
    .maybeSingle();

  if (tierErr || !tier) {
    return jsonResponse({ error: `Tier '${tier_key}' not found` }, 404);
  }
  if (!tier.is_active) {
    return jsonResponse({ error: 'Tier is not active' }, 400);
  }
  if (!tier.razorpay_plan_id) {
    return jsonResponse(
      {
        error: `Tier '${tier_key}' has no razorpay_plan_id. Create the Razorpay plan and store its id in subscription_tiers.razorpay_plan_id.`,
      },
      500
    );
  }

  // total_count is mandatory and finite. 120 cycles = 10 years monthly; 10 cycles = 10 years yearly.
  const totalCount = tier.billing_frequency === 'yearly' ? 10 : 120;

  // ---- Razorpay subscription creation --------------------------------------
  try {
    const res = await fetch(`${RAZORPAY_API_BASE}/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: tier.razorpay_plan_id,
        total_count: totalCount,
        customer_notify: 1,
        notes: {
          merchant_id,
          tier_key: tier.tier_key,
          tier_id: String(tier.id),
          ...(loyalty ? { loyalty: '1' } : {}),
        },
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('[create-subscription] Razorpay error', res.status, text);
      return jsonResponse({ error: `Razorpay error ${res.status}` }, 502);
    }
    const sub = JSON.parse(text);
    return jsonResponse({
      subscription_id: sub.id,
      tier: {
        id: tier.id,
        tier_key: tier.tier_key,
        tier_name: tier.tier_name,
        subscription_fee: tier.subscription_fee,
        billing_frequency: tier.billing_frequency,
      },
    });
  } catch (e) {
    console.error('[create-subscription] fetch failed', e);
    return jsonResponse({ error: (e as Error).message || 'Razorpay request failed' }, 500);
  }
});
