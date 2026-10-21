// supabase/functions/verify-subscription
// -----------------------------------------------------------------------------
// POST {
//   razorpay_payment_id, razorpay_subscription_id, razorpay_signature,
//   merchant_id, tier_key
// }
//
// Verifies the HMAC-SHA256 signature Razorpay Checkout handed to the browser,
// then upserts a `pending_activation` row to merchant_subscriptions. The
// razorpay-webhook function flips status to 'active' when subscription.charged
// fires (source of truth).
//
// Replaces the Next.js route /api/razorpay/verify-subscription on VedicJaalam.
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

// Subscription-payment signature is HMAC-SHA256(KEY_SECRET, payment_id|subscription_id).
// Different from one-time orders which use order_id|payment_id.
async function verifySignature(
  payment_id: string,
  subscription_id: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const payload = `${payment_id}|${subscription_id}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const expectedHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (expectedHex.length !== signature.length) return false;
  // Constant-time comparison — avoids timing-attack signal on signature length.
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// Supabase edge runtime exposes EdgeRuntime.waitUntil for background tasks.
// @ts-ignore
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

// Best-effort merchant notification: in-app log + device push via
// send-merchant-push. Never throws and never blocks the caller.
function notifyMerchant(admin: any, merchantId: string, type: string, title: string, bodyText: string) {
  const task = (async () => {
    try {
      await admin.from('notification_logs').insert({
        merchant_id: merchantId, notification_type: type, channel: 'in_app',
        subject: title, body: bodyText, status: 'sent',
      });
    } catch (_) { /* in-app log is best-effort */ }
    try {
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (url && key) {
        await fetch(`${url}/functions/v1/send-merchant-push`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchant_id: merchantId, title, body: bodyText, data: { type } }),
        });
      }
    } catch (_) { /* push is best-effort */ }
  })();
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(task);
  return task;
}

// ── GST on subscriptions ─────────────────────────────────────────────────────
// subscription_tiers.subscription_fee is the BASE (pre-GST) price; the Razorpay
// plan (what is actually debited) is base + GST. subscription_gst_breakup
// (service_role RPC) returns the merchant's CGST+SGST / IGST split. If the RPC
// is missing (migration not applied) we fall back to the base fee.
const SUB_GST_COLS = ['base_amount', 'gst_rate_percent', 'cgst_amount', 'sgst_amount', 'igst_amount', 'gst_amount', 'total_amount', 'billing_state', 'supply_type'];
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function fetchGstBreakup(admin: any, merchantId: string, tierKey: string): Promise<Record<string, unknown> | null> {
  try {
    const { data, error } = await admin
      .rpc('subscription_gst_breakup', { p_merchant_id: merchantId, p_tier_key: tierKey })
      .single();
    if (error || !data) {
      console.warn('[verify-subscription] subscription_gst_breakup unavailable — using base fee:', error?.message || 'no row');
      return null;
    }
    const r = data as Record<string, unknown>;
    const total = Number(r.total_amount);
    if (!Number.isFinite(total) || total <= 0) return null;
    return {
      total_recurring_amount: total,
      base_amount: num(r.base_amount),
      gst_rate_percent: num(r.gst_rate_percent),
      cgst_amount: num(r.cgst_amount),
      sgst_amount: num(r.sgst_amount),
      igst_amount: num(r.igst_amount),
      gst_amount: num(r.gst_amount),
      total_amount: total,
      billing_state: (r.buyer_state as string) ?? null,
      supply_type: r.supply_type === 'inter' ? 'inter' : 'intra',
    };
  } catch (e) {
    console.warn('[verify-subscription] subscription_gst_breakup threw — using base fee:', (e as any)?.message);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // ---- Auth -----------------------------------------------------------------
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Unauthorized: missing token' }, 401);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (authError || !user) return jsonResponse({ error: 'Unauthorized: invalid token' }, 401);

  // ---- Body -----------------------------------------------------------------
  let body: {
    razorpay_payment_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature?: string;
    merchant_id?: string;
    tier_key?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  const {
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    merchant_id,
    tier_key,
  } = body;
  if (
    !razorpay_payment_id ||
    !razorpay_subscription_id ||
    !razorpay_signature ||
    !merchant_id ||
    !tier_key
  ) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }
  if (merchant_id !== user.id) {
    return jsonResponse({ error: 'merchant_id does not match the authenticated user' }, 403);
  }

  // ---- HMAC verify ----------------------------------------------------------
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!secret) return jsonResponse({ error: 'Razorpay key secret not configured' }, 503);
  const valid = await verifySignature(
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    secret
  );
  if (!valid) return jsonResponse({ error: 'Signature mismatch' }, 400);

  // ---- Tier lookup (for the recurring amount) -------------------------------
  const { data: tier } = await supabaseAdmin
    .from('subscription_tiers')
    .select('tier_key, tier_name, subscription_fee')
    .eq('tier_key', tier_key)
    .maybeSingle();

  // Recurring amount = GST-inclusive total (base fee + GST) — what Razorpay
  // debits each cycle. No paid loyalty add-on. Falls back to the base fee if
  // the GST RPC isn't available yet.
  const gst = await fetchGstBreakup(supabaseAdmin, merchant_id, tier?.tier_key ?? tier_key);
  const totalRecurringAmount = gst ? gst.total_recurring_amount : (tier?.subscription_fee ?? 0);

  // ---- Upsert pending_activation -------------------------------------------
  // merchant_subscriptions.plan_name is the tier_key (other edge functions
  // join on tier_key = plan_name). The webhook flips status -> 'active' and
  // fills current_period_start/end from subscription.charged.
  const row: Record<string, unknown> = {
    merchant_id,
    plan_name: tier?.tier_key ?? tier_key,
    total_recurring_amount: totalRecurringAmount,
    status: 'pending_activation',
    billing_type: 'razorpay',
    current_period_start: null,
    current_period_end: null,
    // Loyalty (redemption partner) is now a free feature for every merchant.
    loyalty_redemption_enabled: true,
    loyalty_addon_price: null,
    razorpay_subscription_id,
    razorpay_payment_id,
    // GST breakup columns (base_amount … supply_type) when available.
    ...(gst ? Object.fromEntries(SUB_GST_COLS.map((c) => [c, gst[c]])) : {}),
  };
  let { error: upsertErr } = await supabaseAdmin
    .from('merchant_subscriptions')
    .upsert(row, { onConflict: 'razorpay_subscription_id' });
  // Schema lag: retry without the GST breakup columns if they aren't there yet.
  if (upsertErr && SUB_GST_COLS.some((c) => c in row && (upsertErr!.message || '').includes(c))) {
    console.warn('[verify-subscription] GST columns missing — retrying without them:', upsertErr.message);
    for (const c of SUB_GST_COLS) delete row[c];
    ({ error: upsertErr } = await supabaseAdmin
      .from('merchant_subscriptions')
      .upsert(row, { onConflict: 'razorpay_subscription_id' }));
  }

  if (upsertErr) {
    console.error('[verify-subscription] DB upsert failed', upsertErr);
    return jsonResponse({ error: `DB write failed: ${upsertErr.message}` }, 500);
  }

  // Confirm the web-checkout completion (in-app + push). This is the ONLY push
  // for a fresh subscribe / frequency-switch upgrade re-subscribe — the webhook's
  // first subscription.charged won't fire the renewal push (it's gated to a prior
  // 'active' status, and this row is pending_activation).
  const tierLabel = tier?.tier_name ?? tier_key;
  notifyMerchant(
    supabaseAdmin, merchant_id, 'subscription_activated',
    'Subscription confirmed 🎉',
    `Payment received — your DealFynd ${tierLabel} plan is now active. You're all set.`,
  );

  return jsonResponse({ success: true, razorpay_subscription_id });
});
