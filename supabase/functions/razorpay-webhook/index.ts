// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

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
      if (tier.subscription_fee != null) patch.total_recurring_amount = tier.subscription_fee;
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
          patch.plan_name = planTier.tier_key;
          if (planTier.subscription_fee != null) patch.total_recurring_amount = planTier.subscription_fee;
          patch.pending_tier_id = null;
          patch.pending_plan_name = null;
          patch.pending_amount = null;
          patch.pending_effective_date = null;
        }
      }
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

  const { error: upsertErr } = await supabase
    .from('merchant_subscriptions')
    .upsert(patch, { onConflict: 'razorpay_subscription_id' });
  if (upsertErr) {
    console.error('[razorpay-webhook] Upsert failed:', upsertErr);
    // Returning 500 makes Razorpay retry — desired so we don't drop state.
    return new Response('DB error', { status: 500 });
  }

  // Billing ledger — record the actual charge so revenue/billing analytics
  // (PrismIQ "Billing" cube) have real payment HISTORY. merchant_subscriptions
  // only holds the current state. Idempotent on razorpay_payment_id so webhook
  // retries never double-count; non-fatal so a ledger hiccup can't block
  // subscription activation (the upsert above is the critical write).
  if (event.event === 'subscription.charged' && payEntity?.id && typeof payEntity.amount === 'number') {
    const rupees = payEntity.amount / 100; // Razorpay sends paise
    // Matches the EXISTING merchant_payments schema (GST-invoice ledger). We record
    // the gross charge for analytics; the GST split (cgst/sgst/igst) is left at the
    // table defaults and can be computed by a dedicated invoicing flow later.
    // order_id is NOT NULL and subscription charges have no separate order, so we
    // use the payment id. Idempotent on transaction_id (unique).
    const { error: payErr } = await supabase
      .from('merchant_payments')
      .upsert({
        merchant_id: merchantId,
        subscription_id: existingSub?.id ?? null,
        transaction_id: payEntity.id,
        order_id: payEntity.id,
        amount_base: rupees,
        amount_total: rupees,
        currency: payEntity.currency || 'INR',
        payment_method: payEntity.method ?? null,
        payment_status: 'captured',
      }, { onConflict: 'transaction_id', ignoreDuplicates: true });
    if (payErr) console.error('[razorpay-webhook] merchant_payments ledger insert failed (non-fatal):', payErr.message);
  }

  return new Response('ok', { status: 200 });
});
