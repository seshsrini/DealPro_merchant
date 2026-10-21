// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Supabase edge runtime exposes EdgeRuntime.waitUntil for background tasks.
// @ts-ignore
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

// Best-effort merchant notification: in-app log + device push via
// send-merchant-push. Never throws and never blocks the webhook ack.
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

// Razorpay subscription webhook handler.
//
// Deploy with JWT verification OFF (Razorpay can't send a Supabase JWT):
//   supabase functions deploy razorpay-webhook --no-verify-jwt
//
// Configure in Razorpay dashboard → Settings → Webhooks:
//   URL:     https://<project-ref>.functions.supabase.co/razorpay-webhook
//   Secret:  paste the same value into RAZORPAY_WEBHOOK_SECRET below
//   Events:  subscription.authenticated, subscription.activated,
//            subscription.charged, subscription.completed,
//            subscription.cancelled, subscription.paused,
//            subscription.resumed, subscription.halted
//
// CRITICAL gotchas (locked-in decisions, do not change):
//  - Verify HMAC over the RAW body. Reading req.json() first corrupts bytes
//    (whitespace + ordering) and the signature will never match.
//  - The signing secret here is the WEBHOOK secret, not the API key_secret.
//  - subscription.charged is the per-cycle access trigger (paid for the
//    current period). subscription.activated only confirms auth — do not
//    grant access on that event alone.
//  - Return 2xx fast. Razorpay retries any non-2xx for 24h with backoff.

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Referral reward: every 5 cumulative qualified referrals earns ONE free month;
// credits carry over (floor(referrals/5) − months already granted). Razorpay
// owns the recurring schedule, so we can't skip a cycle — instead we let it
// charge and REFUND that payment when a credit is available (monthly plans only).
const FREE_MONTH_REFERRALS = 5;

async function razorpayRefund(paymentId: string): Promise<{ id: string } | null> {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!keyId || !keySecret) {
    console.error('[razorpay-webhook] RAZORPAY_KEY_ID/SECRET not set — cannot refund');
    return null;
  }
  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${keyId}:${keySecret}`),
    },
    // Full refund (no amount). speed:optimum = fastest available rail.
    body: JSON.stringify({ speed: 'optimum', notes: { reason: 'referral_free_month' } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[razorpay-webhook] Refund failed:', json?.error?.description || res.status);
    return null;
  }
  return json;
}

// ── GST on subscriptions ─────────────────────────────────────────────────────
// subscription_tiers.subscription_fee is the BASE (pre-GST) price; Razorpay
// plans are priced at base + GST (18%). The DB RPC subscription_gst_breakup
// (service_role only) resolves the merchant's billing state and returns the
// CGST+SGST (intra-state, supplier = Karnataka) or IGST (inter-state) split.
// Every caller below degrades gracefully if the RPC / columns are missing
// (migration not applied yet) — a webhook must never fail because of GST.
interface GstBreakup {
  base_amount: number;
  gst_rate_percent: number;
  supply_type: 'intra' | 'inter';
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_amount: number;
  total_amount: number;
  buyer_state: string | null;
  hsn_sac_code: string | null;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

async function fetchGstBreakup(admin: any, merchantId: string, tierKey: string): Promise<GstBreakup | null> {
  try {
    const { data, error } = await admin
      .rpc('subscription_gst_breakup', { p_merchant_id: merchantId, p_tier_key: tierKey })
      .single();
    if (error || !data) {
      console.warn('[razorpay-webhook] subscription_gst_breakup unavailable — falling back to pre-GST amounts:', error?.message || 'no row');
      return null;
    }
    const r = data as Record<string, unknown>;
    const total = Number(r.total_amount);
    if (!Number.isFinite(total) || total <= 0) return null;
    return {
      base_amount: num(r.base_amount),
      gst_rate_percent: num(r.gst_rate_percent),
      supply_type: r.supply_type === 'inter' ? 'inter' : 'intra',
      cgst_amount: num(r.cgst_amount),
      sgst_amount: num(r.sgst_amount),
      igst_amount: num(r.igst_amount),
      gst_amount: num(r.gst_amount),
      total_amount: total,
      buyer_state: (r.buyer_state as string) ?? null,
      hsn_sac_code: (r.hsn_sac_code as string) ?? null,
    };
  } catch (e) {
    console.warn('[razorpay-webhook] subscription_gst_breakup threw — falling back:', (e as any)?.message);
    return null;
  }
}

// Re-split an amount that was actually debited (GST-inclusive) using the
// breakup's rate + supply type, so base + GST always equals the debit.
function splitDebited(debited: number, ref: GstBreakup): GstBreakup {
  const rate = ref.gst_rate_percent;
  const base = round2(debited / (1 + rate / 100));
  const gst = round2(debited - base);
  const cgst = ref.supply_type === 'intra' ? round2(gst / 2) : 0;
  const sgst = ref.supply_type === 'intra' ? round2(gst - cgst) : 0;
  const igst = ref.supply_type === 'inter' ? gst : 0;
  return { ...ref, base_amount: base, gst_amount: gst, cgst_amount: cgst, sgst_amount: sgst, igst_amount: igst, total_amount: debited };
}

// merchant_subscriptions breakup columns (added by the GST migration).
const SUB_GST_COLS = ['base_amount', 'gst_rate_percent', 'cgst_amount', 'sgst_amount', 'igst_amount', 'gst_amount', 'total_amount', 'billing_state', 'supply_type'];
function subscriptionGstColumns(b: GstBreakup): Record<string, unknown> {
  return {
    base_amount: b.base_amount,
    gst_rate_percent: b.gst_rate_percent,
    cgst_amount: b.cgst_amount,
    sgst_amount: b.sgst_amount,
    igst_amount: b.igst_amount,
    gst_amount: b.gst_amount,
    total_amount: b.total_amount,
    billing_state: b.buyer_state,
    supply_type: b.supply_type,
  };
}

// merchant_profiles.gstin is AES-encrypted client-side, so it can't be copied
// into merchant_payments.merchant_gstin (varchar 15) blindly. Use it only if it
// is a plain, valid GSTIN; otherwise look for the plain GSTIN inside the raw KYC
// provider response saved by verify-business-document (gstin_verification):
//   Sandbox → data.data.gstin · Surepass/Deepvue → data.gstin (or data.gstin_number)
//   · Surepass echo / mock → data.id_number.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
function asGstin(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  return GSTIN_RE.test(s) ? s : null;
}
async function resolveMerchantGstin(admin: any, merchantId: string): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from('merchant_profiles')
      .select('gstin, gstin_verification')
      .eq('id', merchantId)
      .maybeSingle();
    if (error || !data) return null;
    const direct = asGstin(data.gstin);
    if (direct) return direct;
    const v = data.gstin_verification as any;
    if (!v || typeof v !== 'object') return null;
    return asGstin(v?.data?.data?.gstin)
      || asGstin(v?.data?.gstin)
      || asGstin(v?.data?.gstin_number)
      || asGstin(v?.data?.id_number)
      || asGstin(v?.gstin)
      || null;
  } catch {
    return null;
  }
}

interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  plan_id?: string;
  current_start?: number;
  current_end?: number;
  charge_at?: number;
  ended_at?: number | null;
  notes?: Record<string, string> | null;
}

interface RazorpayPaymentEntity {
  id: string;
  status: string;
  amount?: number;
  currency?: string;
  method?: string;
}

interface RazorpayWebhookEvent {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity };
    payment?: { entity: RazorpayPaymentEntity };
  };
  created_at?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET not set');
    // 500 → Razorpay retries. That's what we want until we configure the secret.
    return new Response('Server not configured', { status: 500 });
  }

  // 1) Read raw body BEFORE any parsing — required for signature verification.
  const rawBody = await req.text();

  // 2) Verify signature.
  const provided = req.headers.get('x-razorpay-signature') || '';
  const expected = await hmacSha256Hex(webhookSecret, rawBody);
  if (!provided || !timingSafeEqual(expected, provided)) {
    console.warn('[razorpay-webhook] Signature mismatch');
    return new Response('Invalid signature', { status: 400 });
  }

  // 3) Now safe to parse.
  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const subEntity = event.payload?.subscription?.entity;
  const payEntity = event.payload?.payment?.entity;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Recurring-charge reconciliation — the admin billing run records each debit
  // optimistically as 'captured'; these payment.* events (which carry a payment
  // entity but no subscription) confirm the real outcome.
  if (!subEntity?.id && payEntity?.id && (event.event === 'payment.captured' || event.event === 'payment.failed')) {
    const ok = event.event === 'payment.captured';
    await supabase.from('merchant_payments')
      .update({ payment_status: ok ? 'captured' : 'failed', failure_reason: ok ? null : 'payment failed' })
      .eq('transaction_id', payEntity.id);
    await supabase.from('billing_run_items')
      .update({ status: ok ? 'captured' : 'failed', error: ok ? null : 'payment failed' })
      .eq('razorpay_payment_id', payEntity.id);
    return new Response('ok', { status: 200 });
  }

  if (!subEntity?.id) {
    // Some non-subscription events may slip through — ack so they don't retry forever.
    console.log('[razorpay-webhook] Skipping event without subscription:', event.event);
    return new Response('ok', { status: 200 });
  }

  // Idempotency: log every event so retries don't double-apply business logic.
  // The unique key is (razorpay_event_id) — Razorpay sends an id header.
  const razorpayEventId = req.headers.get('x-razorpay-event-id') || `${event.event}:${subEntity.id}:${event.created_at ?? ''}`;
  const { data: existing } = await supabase
    .from('razorpay_webhook_events')
    .select('id')
    .eq('event_id', razorpayEventId)
    .maybeSingle();
  if (existing) {
    return new Response('ok (duplicate)', { status: 200 });
  }
  await supabase.from('razorpay_webhook_events').insert({
    event_id: razorpayEventId,
    event_type: event.event,
    razorpay_subscription_id: subEntity.id,
    payload: event as unknown as Record<string, unknown>,
  });

  // Pull merchant_id off the subscription's notes (we set this in
  // create-subscription). Fall back to the stored row if notes are stripped.
  const merchantIdFromNotes = subEntity.notes?.merchant_id;
  const tierKeyFromNotes = subEntity.notes?.tier_key;

  // Look up the existing row by razorpay_subscription_id. The verify route
  // creates a pending_activation row, so this should normally hit.
  const { data: existingSub } = await supabase
    .from('merchant_subscriptions')
    .select('id, merchant_id, plan_name, status')
    .eq('razorpay_subscription_id', subEntity.id)
    .maybeSingle();

  const merchantId = existingSub?.merchant_id || merchantIdFromNotes;
  if (!merchantId) {
    console.error('[razorpay-webhook] No merchant_id resolvable for', subEntity.id);
    return new Response('ok (no merchant)', { status: 200 });
  }

  // Map Razorpay event → merchant_subscriptions.status.
  // subscription.charged is the per-cycle access trigger — this is what flips
  // the merchant to 'active' for the new period.
  const patch: Record<string, unknown> = {
    razorpay_subscription_id: subEntity.id,
    merchant_id: merchantId,
    razorpay_status: subEntity.status,
    razorpay_current_period_end: subEntity.current_end
      ? new Date(subEntity.current_end * 1000).toISOString()
      : null,
  };

  // GST breakup per tier, memoised so one event never calls the RPC twice.
  const breakupCache = new Map<string, Promise<GstBreakup | null>>();
  const gstBreakupFor = (tierKey: string) => {
    if (!breakupCache.has(tierKey)) breakupCache.set(tierKey, fetchGstBreakup(supabase, merchantId, tierKey));
    return breakupCache.get(tierKey)!;
  };
  // Recurring amount = GST-inclusive total (what Razorpay debits each cycle).
  // Falls back to the base fee if the GST RPC isn't available yet.
  const applyRecurringAmount = async (tierKey: string, fee: unknown) => {
    const b = await gstBreakupFor(tierKey);
    if (b) {
      patch.total_recurring_amount = b.total_amount;
      Object.assign(patch, subscriptionGstColumns(b));
    } else if (fee != null) {
      patch.total_recurring_amount = fee;
    }
  };

  // Tier the charge is for — resolved in subscription.charged (plan_id first, as
  // it reflects a parked downgrade; then notes; then the stored plan).
  let chargedTierKey: string | null = null;

  if (tierKeyFromNotes && !existingSub?.plan_name) {
    const { data: tier } = await supabase
      .from('subscription_tiers')
      .select('tier_key, subscription_fee')
      .eq('tier_key', tierKeyFromNotes)
      .maybeSingle();
    if (tier?.tier_key) {
      // plan_name is the tier_key by convention — other edge functions
      // (merchant-subscription, manage-subscription) join on
      // tier_key.eq.plan_name to look up tier limits.
      patch.plan_name = tier.tier_key;
      await applyRecurringAmount(tier.tier_key, tier.subscription_fee);
      patch.billing_type = 'razorpay';
    }
  }

  switch (event.event) {
    case 'subscription.authenticated':
      patch.status = 'pending_activation';
      break;
    case 'subscription.activated':
      // Auth complete — billing scheduled. Don't grant access yet; wait for
      // subscription.charged.
      patch.status = existingSub?.status === 'active' ? 'active' : 'pending_activation';
      break;
    case 'subscription.charged': {
      patch.status = 'active';
      patch.current_period_end = subEntity.current_end
        ? new Date(subEntity.current_end * 1000).toISOString()
        : null;
      if (payEntity?.id) patch.razorpay_payment_id = payEntity.id;
      // Reconcile the plan from the subscription's CURRENT plan_id (authoritative).
      // This applies a parked downgrade the moment Razorpay charges the new
      // (lower) plan at cycle end, and confirms an upgrade. Clears any pending_*.
      if (subEntity.plan_id) {
        const { data: planTier } = await supabase
          .from('subscription_tiers')
          .select('tier_key, subscription_fee')
          .eq('razorpay_plan_id', subEntity.plan_id)
          .maybeSingle();
        if (planTier?.tier_key) {
          chargedTierKey = planTier.tier_key;
          patch.plan_name = planTier.tier_key;
          await applyRecurringAmount(planTier.tier_key, planTier.subscription_fee);
          patch.pending_tier_id = null;
          patch.pending_plan_name = null;
          patch.pending_amount = null;
          patch.pending_effective_date = null;
        }
      }
      if (!chargedTierKey) chargedTierKey = tierKeyFromNotes || existingSub?.plan_name || null;
      break;
    }
    case 'subscription.completed':
      patch.status = 'completed';
      break;
    case 'subscription.cancelled':
      patch.status = 'cancelled';
      patch.cancelled_at = new Date().toISOString();
      break;
    case 'subscription.paused':
      patch.status = 'paused';
      break;
    case 'subscription.resumed':
      patch.status = 'active';
      break;
    case 'subscription.halted':
      // Retries exhausted — payment failed. Revoke access.
      patch.status = 'halted';
      break;
    default:
      console.log('[razorpay-webhook] Unhandled event:', event.event);
      return new Response('ok (unhandled)', { status: 200 });
  }

  let { error: upsertErr } = await supabase
    .from('merchant_subscriptions')
    .upsert(patch, { onConflict: 'razorpay_subscription_id' });
  // Schema lag: if the GST breakup columns aren't there yet, retry without them
  // rather than 500-ing (which would block activation behind Razorpay retries).
  if (upsertErr && SUB_GST_COLS.some((c) => c in patch && (upsertErr!.message || '').includes(c))) {
    console.warn('[razorpay-webhook] GST columns missing on merchant_subscriptions — retrying without them:', upsertErr.message);
    for (const c of SUB_GST_COLS) delete patch[c];
    ({ error: upsertErr } = await supabase
      .from('merchant_subscriptions')
      .upsert(patch, { onConflict: 'razorpay_subscription_id' }));
  }
  if (upsertErr) {
    console.error('[razorpay-webhook] Upsert failed:', upsertErr);
    // Returning 500 makes Razorpay retry — desired so we don't drop state.
    return new Response('DB error', { status: 500 });
  }

  // Notify the merchant on the two outcomes they care about: a successful renewal
  // (a SUBSEQUENT cycle — the first charge is the initial subscribe, already
  // confirmed in-app, so gate on the prior status being active) and a halt
  // (Razorpay's retries exhausted → payment failed → access revoked).
  if (event.event === 'subscription.charged' && existingSub?.status === 'active') {
    const amt = (payEntity && typeof payEntity.amount === 'number')
      ? ` for ₹${(payEntity.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (incl. GST)`
      : '';
    notifyMerchant(supabase, merchantId, 'payment_success', 'Subscription renewed',
      `Your DealFynd plan renewed${amt}. You're set for another month.`);
  } else if (event.event === 'subscription.halted') {
    notifyMerchant(supabase, merchantId, 'payment_failed', 'Payment failed — action needed',
      'We could not renew your DealFynd subscription after several attempts. Please update your payment method to keep your deals live.');
  }

  // Billing ledger — record the actual charge so revenue/billing analytics
  // (PrismIQ "Billing" cube) have real payment HISTORY. merchant_subscriptions
  // only holds the current state. Idempotent on razorpay_payment_id so webhook
  // retries never double-count; non-fatal so a ledger hiccup can't block
  // subscription activation (the upsert above is the critical write).
  if (event.event === 'subscription.charged' && payEntity?.id && typeof payEntity.amount === 'number') {
    const rupees = round2(payEntity.amount / 100); // Razorpay sends paise
    // Matches the EXISTING merchant_payments schema (GST-invoice ledger).
    // amount_total = what Razorpay actually debited (source of truth). The GST
    // split comes from subscription_gst_breakup for the charged tier; if the
    // breakup total doesn't match the debit (old pre-GST plan, offer discount,
    // proration) the split is re-derived FROM the debit so base + GST == debit.
    // If the RPC is unavailable we keep the old behaviour (base = total).
    // order_id is NOT NULL and subscription charges have no separate order, so we
    // use the payment id. Idempotent on transaction_id (unique).
    const ledger: Record<string, unknown> = {
      merchant_id: merchantId,
      subscription_id: existingSub?.id ?? null,
      transaction_id: payEntity.id,
      order_id: payEntity.id,
      amount_base: rupees,
      amount_total: rupees,
      currency: payEntity.currency || 'INR',
      payment_method: payEntity.method ?? null,
      payment_status: 'captured',
    };
    const breakup = chargedTierKey ? await gstBreakupFor(chargedTierKey) : null;
    if (breakup) {
      let b = breakup;
      if (Math.abs(breakup.total_amount - rupees) > 0.009) {
        console.warn(`[razorpay-webhook] Debited ₹${rupees} != GST breakup total ₹${breakup.total_amount} for tier ${chargedTierKey} (payment ${payEntity.id}) — deriving the GST split from the debited amount.`);
        b = splitDebited(rupees, breakup);
      }
      Object.assign(ledger, {
        amount_base: b.base_amount,
        gst_rate_percent: b.gst_rate_percent,
        cgst_amount: b.cgst_amount,
        sgst_amount: b.sgst_amount,
        igst_amount: b.igst_amount,
        gst_amount: b.gst_amount,
        supply_type: b.supply_type,
        billing_state: b.buyer_state ? String(b.buyer_state).slice(0, 50) : null,
        hsn_sac_code: b.hsn_sac_code,
      });
      const gstin = await resolveMerchantGstin(supabase, merchantId);
      if (gstin) ledger.merchant_gstin = gstin;
    } else {
      console.warn(`[razorpay-webhook] No GST breakup for payment ${payEntity.id} (tier ${chargedTierKey ?? 'unknown'}) — recording amount_base = amount_total.`);
    }
    let { error: payErr } = await supabase
      .from('merchant_payments')
      .upsert(ledger, { onConflict: 'transaction_id', ignoreDuplicates: true });
    // Schema lag: gst_amount / supply_type are new columns — retry without them.
    if (payErr && /gst_amount|supply_type/.test(payErr.message || '')) {
      console.warn('[razorpay-webhook] merchant_payments GST columns missing — retrying without them:', payErr.message);
      delete ledger.gst_amount;
      delete ledger.supply_type;
      ({ error: payErr } = await supabase
        .from('merchant_payments')
        .upsert(ledger, { onConflict: 'transaction_id', ignoreDuplicates: true }));
    }
    if (payErr) console.error('[razorpay-webhook] merchant_payments ledger insert failed (non-fatal):', payErr.message);

    // ── Referral reward: handled by the OFFER model, not here ──────────────
    // The referral reward is a one-cycle Razorpay discount OFFER applied via the
    // signup trigger → `process-referral-reward` (a credit on the merchant's
    // Razorpay subscription; there is no RazorpayX payout). The old
    // charge-then-refund path that used to live here was REMOVED because it
    // double-rewarded (it granted a full refund on top of the offer discount).
    // Do not reinstate a refund here — there must be exactly ONE referral engine.
  }

  return new Response('ok', { status: 200 });
});
