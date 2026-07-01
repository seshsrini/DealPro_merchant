// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ── Razorpay REST helpers ───────────────────────────────────────────────────
// Plan changes and cancellations must be reflected in Razorpay (the source of
// truth for the recurring schedule) or it keeps charging the old plan / keeps
// charging after a "cancel". Basic-auth with the API key id + secret.
const RZP_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
const RZP_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');

async function razorpayFetch(path: string, init: RequestInit): Promise<any> {
  if (!RZP_KEY_ID || !RZP_KEY_SECRET) {
    throw new Error('Razorpay API keys are not configured on the server.');
  }
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`),
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.description || `Razorpay request failed (${res.status})`);
  }
  return json;
}

// Swap the plan on an existing subscription. `when` = 'now' charges a prorated
// amount immediately (upgrade); 'cycle_end' applies the change at the next
// billing date (downgrade) with no mid-cycle charge.
function updateRazorpaySubscriptionPlan(subId: string, planId: string, when: 'now' | 'cycle_end') {
  return razorpayFetch(`/subscriptions/${subId}`, {
    method: 'PATCH',
    body: JSON.stringify({ plan_id: planId, schedule_change_at: when, customer_notify: 1 }),
  });
}

// cancel_at_cycle_end: 1 keeps the subscription active until period end then
// stops; 0 cancels immediately.
function cancelRazorpaySubscription(subId: string, atCycleEnd: boolean) {
  return razorpayFetch(`/subscriptions/${subId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ cancel_at_cycle_end: atCycleEnd ? 1 : 0 }),
  });
}

// Supabase edge runtime exposes EdgeRuntime.waitUntil for background tasks.
// @ts-ignore
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

// Best-effort merchant notification: writes an in-app log + fires a device push
// via send-merchant-push. Never throws and never blocks the caller — a plan
// change or cancel must succeed even if delivery fails. Backgrounded with
// EdgeRuntime.waitUntil so the function isn't torn down mid-send.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Authenticate the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No token provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // 2. Verify user is a merchant
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('merchant_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || userProfile?.role !== 'merchant') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Merchant access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const body = await req.json();
    const { action } = body;

    // 3. Handle different actions
    if (action === 'check') {
      const nowIso = new Date().toISOString();

      // Safety net (webhook-independent): if the merchant CANCELLED and the paid
      // period has since ended, flip the row to 'cancelled' here — so a missed
      // subscription.cancelled webhook can't leave a stale 'active' status. Only
      // rows the merchant explicitly cancelled (cancel_at_period_end = true) are
      // touched: a non-cancelled expired row could be a renewal the charged
      // webhook simply hasn't synced yet, so we must NOT cancel those. (Gating
      // already excludes it via current_period_end >= now; this fixes the status
      // field for records/analytics and any status-only checks.) Best-effort.
      try {
        await supabaseAdmin
          .from('merchant_subscriptions')
          .update({ status: 'cancelled', cancelled_at: nowIso })
          .eq('merchant_id', user.id)
          .eq('status', 'active')
          .eq('cancel_at_period_end', true)
          .lt('current_period_end', nowIso);
      } catch (e) {
        console.warn('[merchant-subscription] cancel self-heal skipped:', (e as any)?.message);
      }

      // Check if merchant has active subscription
      const { data, error } = await supabaseAdmin
        .from('merchant_subscriptions')
        .select('status, plan_name, current_period_end')
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .gte('current_period_end', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[manage-subscription] Check error:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({
          hasActiveSubscription: !!data,
          subscription_status: data?.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'change_tier') {
      // UPGRADE  → instant benefit: switch plan_name now (higher limits active
      //            immediately); the new (higher) rate is charged from the next
      //            billing date by the billing run (no mid-cycle proration).
      // DOWNGRADE → parked in pending_* and applied at the next billing date
      //            (merchant keeps the plan they paid for until then).
      // Either way we set a change-lock so they can't change again for at least
      // one billing month (the later of the next billing date or +30 days).
      const { tier_key } = body;
      if (!tier_key) {
        return new Response(JSON.stringify({ error: 'tier_key is required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      const { data: sub } = await supabaseAdmin
        .from('merchant_subscriptions')
        .select('id, plan_name, current_period_end, billing_type, razorpay_subscription_id')
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!sub) {
        return new Response(JSON.stringify({ error: 'No active subscription to change. Subscribe first.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      const isRazorpaySub = sub.billing_type === 'razorpay' && !!sub.razorpay_subscription_id;

      // No change-lock: an upgrade is a full instant payment (Model B) and a
      // downgrade is parked for the next cycle, so there's no "instant benefit
      // then revert" to guard against — merchants may change plans freely.

      const { data: newTier } = await supabaseAdmin
        .from('subscription_tiers')
        .select('id, tier_key, tier_name, subscription_fee, billing_frequency, razorpay_plan_id')
        .eq('tier_key', tier_key)
        .maybeSingle();
      if (!newTier) {
        return new Response(JSON.stringify({ error: `Tier '${tier_key}' not found` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
      }
      if (newTier.tier_key === sub.plan_name) {
        return new Response(JSON.stringify({ success: true, message: 'Already on this plan.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // Compare against the current tier's fee to decide upgrade vs downgrade.
      const { data: curTier } = await supabaseAdmin
        .from('subscription_tiers')
        .select('subscription_fee, billing_frequency')
        .eq('tier_key', sub.plan_name)
        .maybeSingle();
      const curFee = Number(curTier?.subscription_fee || 0);
      const newFee = Number(newTier.subscription_fee || 0);
      const isUpgrade = newFee > curFee;
      // The tier fee is the full recurring amount — no paid loyalty add-on.
      const recurringAmount = newFee;

      const now = new Date();

      // ── Razorpay-managed subscription: drive the change through Razorpay ─────
      if (isRazorpaySub) {
        if (!newTier.razorpay_plan_id) {
          return new Response(JSON.stringify({ error: "That plan isn't available for online subscription yet." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        // ── UPGRADE → fresh start from today (Model B / instant gratification) ──
        // An upgrade RESTARTS the subscription from today: the merchant pays the
        // full new amount now, the billing date moves to today, and the deal
        // allowance refreshes to 0/<new limit> immediately. Razorpay can't move a
        // live subscription's billing anchor in place, so route through resubscribe:
        // the app opens web checkout for the new tier; verify-subscription then
        // creates the new cycle (current_period_start = now → the created_at usage
        // window restarts → counts reset to 0), cancels the old subscription, and
        // applies the change-lock so they can't immediately re-change. Covers both
        // same-frequency and frequency-changing upgrades.
        if (isUpgrade) {
          return new Response(JSON.stringify({
            success: true,
            resubscribe: true,
            upgrade: true,
            tier_key: newTier.tier_key,
            tier_name: newTier.tier_name,
            new_amount: recurringAmount,
            message: `Upgrading to ${newTier.tier_name}: you'll pay ₹${recurringAmount} now, your billing date moves to today, and your deal limits refresh right away. Continue to pay.`,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // ── DOWNGRADE → parked, applied at the next billing date (no charge) ──
        // A frequency-changing downgrade still needs a fresh subscription, since
        // Razorpay can't swap a plan across billing intervals on the same sub.
        if ((curTier?.billing_frequency || null) !== (newTier.billing_frequency || null)) {
          return new Response(JSON.stringify({
            success: true,
            resubscribe: true,
            tier_key: newTier.tier_key,
            tier_name: newTier.tier_name,
            message: `Switching to ${newTier.billing_frequency} billing needs a fresh subscription. Continue to set up ${newTier.tier_name}.`,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // Same-frequency downgrade → schedule the plan change at cycle end (the
        // merchant keeps the plan they paid for until then; no mid-cycle charge).
        try {
          await updateRazorpaySubscriptionPlan(
            sub.razorpay_subscription_id as string,
            newTier.razorpay_plan_id,
            'cycle_end',
          );
        } catch (rzpErr: any) {
          const rzpMsg = rzpErr?.message || '';
          // Razorpay can't update a plan in place when the mandate is UPI AutoPay
          // ("subscriptions cannot be updated when payment mode is upi") — the only
          // way to switch is a fresh subscription. Fall back to the resubscribe flow
          // (the app opens checkout; verify-subscription cancels the old sub once the
          // new one is active) instead of failing. Same handling as a frequency switch.
          if (/payment mode is upi|cannot be updated/i.test(rzpMsg)) {
            return new Response(JSON.stringify({
              success: true,
              resubscribe: true,
              tier_key: newTier.tier_key,
              tier_name: newTier.tier_name,
              message: `To switch to ${newTier.tier_name}, we'll set up a new subscription — your UPI AutoPay plan can't be changed in place. Continue to pay.`,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
          }
          console.error('[merchant-subscription] Razorpay plan update failed:', rzpMsg);
          return new Response(JSON.stringify({ error: rzpMsg || 'Could not update your plan with Razorpay. Please try again.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 });
        }
      }

      // NOTE: Razorpay UPGRADES no longer reach here — they return `resubscribe`
      // above and restart via verify-subscription (Model B: full charge now,
      // billing date = today, usage reset). This in-place branch now applies only to
      //   • LEGACY (non-Razorpay) upgrades → switch plan_name now; the billing run
      //     applies the new rate next cycle.
      //   • DOWNGRADES (any billing type) → park in pending_* for the next cycle.
      const patch: Record<string, unknown> = isUpgrade
        ? { plan_name: newTier.tier_key, total_recurring_amount: recurringAmount, pending_tier_id: null, pending_plan_name: null, pending_amount: null, pending_effective_date: null }
        : { pending_tier_id: newTier.id, pending_plan_name: newTier.tier_key, pending_amount: recurringAmount, pending_effective_date: sub.current_period_end };
      patch.updated_at = now.toISOString();

      // Resilience: the lock + pending_* scheduling fields + total_recurring_amount
      // are optional columns that may not exist in every environment yet. If the
      // UPDATE fails because one is missing, drop just that column and retry — a
      // plan change must NEVER hard-fail on a schema lag. (The migration adds these;
      // this loop is the zero-tolerance safety net.) For an upgrade the critical
      // field is plan_name, which always survives, so the new plan still applies.
      const OPTIONAL_COLS = [
        'tier_change_locked_until', 'pending_tier_id', 'pending_plan_name',
        'pending_amount', 'pending_effective_date', 'total_recurring_amount',
      ];
      let updErr: any;
      for (let attempt = 0; attempt <= OPTIONAL_COLS.length; attempt++) {
        ({ error: updErr } = await supabaseAdmin.from('merchant_subscriptions').update(patch).eq('id', sub.id));
        if (!updErr) break;
        const msg = updErr.message || '';
        const offending = OPTIONAL_COLS.find((c) => c in patch && msg.includes(c));
        if (!offending) break;     // a genuine error, not a missing optional column
        delete (patch as Record<string, unknown>)[offending];
      }
      if (updErr) throw updErr;

      // Confirm the plan change (in-app + push). Upgrades are instant; downgrades
      // are scheduled for the next billing date.
      notifyMerchant(
        supabaseAdmin, user.id,
        isUpgrade ? 'subscription_upgraded' : 'subscription_downgraded',
        isUpgrade ? 'Plan upgraded 🚀' : 'Plan change scheduled',
        isUpgrade
          ? `You're now on ${newTier.tier_name}. Your new benefits are active right away.`
          : `You'll move to ${newTier.tier_name} on your next billing date — you keep your current plan until then.`,
      );

      return new Response(JSON.stringify({
        success: true,
        upgraded: isUpgrade,
        effective_date: sub.current_period_end,
        new_amount: recurringAmount,
        message: isUpgrade
          ? `Upgraded to ${newTier.tier_name} — your new benefits are active now.${isRazorpaySub ? ` Razorpay has charged the prorated difference; the full ₹${recurringAmount} applies from your next billing date.` : ` The new rate (₹${recurringAmount}) applies from your next billing date.`}`
          : `You'll move to ${newTier.tier_name} on your next billing date — you keep your current plan until then.`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (action === 'fetch') {
      // Fetch current active subscription with tier + plan-change-lock details.
      const fetchActive = (cols: string) => supabaseAdmin
        .from('merchant_subscriptions')
        .select(cols)
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .gte('current_period_end', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let { data, error } = await fetchActive('id, plan_name, status, current_period_start, current_period_end, cancel_at_period_end, billing_type, razorpay_subscription_id, is_test_subscription, tier_change_locked_until, pending_plan_name, pending_effective_date');
      // Resilience: retry without the newer columns if they aren't present yet.
      if (error && /tier_change_locked_until|pending_/i.test(error.message || '')) {
        ({ data, error } = await fetchActive('id, plan_name, status, current_period_start, current_period_end, cancel_at_period_end, billing_type, razorpay_subscription_id, is_test_subscription'));
      }

      if (error) {
        console.error('[manage-subscription] Fetch error:', error);
        throw error;
      }

      if (!data) {
        return new Response(
          JSON.stringify({ subscription: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Get tier details from subscription_tiers
      const { data: tierData, error: tierError } = await supabaseAdmin
        .from('subscription_tiers')
        .select('id, tier_key, tier_name')
        .eq('tier_key', data.plan_name)
        .single();

      if (tierError) {
        console.error('[manage-subscription] Tier fetch error:', tierError);
        // Return subscription without tier_id if tier not found
        return new Response(
          JSON.stringify({ subscription: { ...data, tier_id: null } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          subscription: {
            ...data,
            tier_id: tierData.id,
            tier_name: tierData.tier_name,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'create') {
      // Create new subscription
      const { tier_key, tier_name } = body;

      if (!tier_key || !tier_name) {
        return new Response(
          JSON.stringify({ error: 'Missing tier_key or tier_name' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Deactivate any existing active subscriptions for this merchant
      const { error: deactivateErr } = await supabaseAdmin
        .from('merchant_subscriptions')
        .update({ status: 'cancelled', cancel_at_period_end: true })
        .eq('merchant_id', user.id)
        .eq('status', 'active');

      if (deactivateErr) {
        console.error('[manage-subscription] Deactivate old subs error:', deactivateErr);
        throw deactivateErr;
      }

      // Calculate period dates (1 month from now)
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { data, error } = await supabaseAdmin
        .from('merchant_subscriptions')
        .insert([{
          merchant_id: user.id,
          plan_name: tier_key,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
        }])
        .select()
        .single();

      if (error) {
        console.error('[manage-subscription] Create error:', error);
        throw error;
      }

      console.log(`[manage-subscription] Created subscription for merchant ${user.id}: ${tier_name}, id: ${data.id}`);

      return new Response(
        JSON.stringify({ success: true, subscription: data, subscriptionId: data.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'create_test_subscription') {
      // ──────────────────────────────────────────────────────────────────
      // Test-only bypass for the in-app subscription step. Creates a free
      // 30-day subscription with the highest tier so testers can exercise
      // the rest of the app without going through real payment. Marked
      // is_test_subscription = true so the row can be wiped before launch
      // (DELETE FROM merchant_subscriptions WHERE is_test_subscription).
      //
      // Client-side this action is gated by VITE_ALLOW_TEST_SUBSCRIPTION;
      // the server still validates the request is authenticated to keep
      // strangers from minting test subs against random merchant IDs.
      // ──────────────────────────────────────────────────────────────────
      const { tier_key } = body;
      const planName = tier_key || 'pro_test';

      // Deactivate any existing active subscriptions
      const { error: deactivateErr } = await supabaseAdmin
        .from('merchant_subscriptions')
        .update({ status: 'cancelled', cancel_at_period_end: true })
        .eq('merchant_id', user.id)
        .eq('status', 'active');
      if (deactivateErr) {
        console.error('[merchant-subscription] Test bypass deactivate error:', deactivateErr);
        throw deactivateErr;
      }

      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() + 30); // 30-day test subscription

      const { data, error } = await supabaseAdmin
        .from('merchant_subscriptions')
        .insert([{
          merchant_id: user.id,
          plan_name: planName,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
          is_test_subscription: true,
        }])
        .select()
        .single();
      if (error) {
        console.error('[merchant-subscription] Test bypass insert error:', error);
        throw error;
      }

      console.log(`[merchant-subscription] Created TEST subscription for merchant ${user.id}: ${planName}, id: ${data.id}`);

      return new Response(
        JSON.stringify({ success: true, subscription: data, subscriptionId: data.id, isTest: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'campaign_usage') {
      // Campaign / DOTD limits reset on the merchant's BILLING anniversary (see the
      // window computation below), at midnight IST (UTC+5:30). The Edge runtime is
      // UTC, so every boundary is computed in IST then converted to a UTC instant.

      // 1. Get merchant's active subscription, tier limits, and billing-cycle dates.
      const { data: subscription, error: subError } = await supabaseAdmin
        .from('merchant_subscriptions')
        .select('plan_name, current_period_start, current_period_end')
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .gte('current_period_end', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error('[manage-subscription] Subscription fetch error:', subError);
        throw subError;
      }

      // If no active subscription, return 0 limits
      if (!subscription) {
        return new Response(
          JSON.stringify({
            campaigns_used: 0,
            campaigns_limit: 0,
            dotd_used: 0,
            dotd_limit: 0,
            has_subscription: false
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // 2. Get tier limits
      const { data: tierData, error: tierError } = await supabaseAdmin
        .from('subscription_tiers')
        .select('max_campaigns_per_month, max_dotd_per_month')
        .eq('tier_key', subscription.plan_name)
        .single();

      if (tierError) {
        console.error('[manage-subscription] Tier limits fetch error:', tierError);
        throw tierError;
      }

      // 3. Count campaigns CREATED during the current BILLING cycle.
      // A deal counts in the cycle it was CREATED (created_at), so the counter
      // matches what the merchant actually created (lines up with the Live list)
      // and a future-dated deal can't escape its cycle's limit.
      //
      // Billing renews on the merchant's signup anniversary (instant payment at
      // signup → Razorpay charges that same date every month), so the deal
      // allowance must reset on the SAME date — not the 1st. Otherwise a cycle
      // that straddles a month boundary (e.g. billed on the 27th) would hand out
      // two calendar months' worth of deals.
      //
      // The window is [anchorDay this period, anchorDay next period) at midnight
      // IST. The anchor day comes from when billing started (current_period_start,
      // falling back to current_period_end's day, then to the 1st for any legacy
      // row without dates). It's clamped to each month's length, so a 31st anchor
      // resets on the 30th/28th in shorter months. A day-1 anchor reproduces the
      // old calendar-month behaviour exactly.
      const IST_OFFSET_MS = 5.5 * 3600 * 1000;
      const anchorSource = subscription.current_period_start || subscription.current_period_end || null;
      const anchorDay = anchorSource
        ? new Date(new Date(anchorSource).getTime() + IST_OFFSET_MS).getUTCDate()
        : 1;

      // Clamp a target day to the real length of (year, monthIdx) in IST.
      const clampDay = (y: number, mIdx: number, day: number) =>
        Math.min(day, new Date(Date.UTC(y, mIdx + 1, 0)).getUTCDate());

      // Locate the billing window that contains "now", working in IST.
      const istNow = new Date(Date.now() + IST_OFFSET_MS);
      let wy = istNow.getUTCFullYear();
      let wm = istNow.getUTCMonth();
      if (istNow.getUTCDate() < clampDay(wy, wm, anchorDay)) {
        // Before this month's anchor → the current window started last month.
        wm -= 1;
        if (wm < 0) { wm = 11; wy -= 1; }
      }
      let ny = wy, nm = wm + 1;
      if (nm > 11) { nm = 0; ny += 1; }
      const windowStartTs = new Date(Date.UTC(wy, wm, clampDay(wy, wm, anchorDay)) - IST_OFFSET_MS).toISOString();
      const windowEndTs = new Date(Date.UTC(ny, nm, clampDay(ny, nm, anchorDay)) - IST_OFFSET_MS).toISOString();

      console.log('[manage-subscription] Billing-cycle count window:', {
        merchant_id: user.id,
        anchorDay,
        windowStartTs,
        windowEndTs,
      });

      // Count regular campaigns (exclude DOTD) CREATED this month.
      // Exclude DOTD with `.not(... is true)` — matches both `false` and NULL
      // (regular deals) and excludes only `true`. No chained `.or()`, so the DOTD
      // exclusion can't be silently dropped.
      const { count: campaignsCount, error: campaignsError } = await supabaseAdmin
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', user.id)
        .not('is_deal_of_the_day', 'is', true)
        .gte('created_at', windowStartTs)
        .lt('created_at', windowEndTs);

      console.log('[manage-subscription] Campaign count result:', { campaignsCount, error: campaignsError });

      if (campaignsError) {
        console.error('[manage-subscription] Campaigns count error:', campaignsError);
        throw campaignsError;
      }

      // 4. Count DOTD campaigns CREATED this month
      const { count: dotdCount, error: dotdError } = await supabaseAdmin
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', user.id)
        .eq('is_deal_of_the_day', true)
        .gte('created_at', windowStartTs)
        .lt('created_at', windowEndTs);

      if (dotdError) {
        console.error('[manage-subscription] DOTD count error:', dotdError);
        throw dotdError;
      }

      return new Response(
        JSON.stringify({
          campaigns_used: campaignsCount || 0,
          campaigns_limit: tierData.max_campaigns_per_month,
          dotd_used: dotdCount || 0,
          dotd_limit: tierData.max_dotd_per_month,
          has_subscription: true,
          // Exact moment the allowance refreshes = end of the current billing-cycle
          // window (the merchant's billing date), NOT the 1st of the month. The UI
          // shows this so "wait until … to reset" always names the billing date.
          next_reset: windowEndTs,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'cancel') {
      const { reason } = body;

      // Find the active subscription. NOTE: keep tier_change_locked_until OUT of
      // this select — it's a separate migration that may not be applied; selecting
      // a missing column would throw. We read the lock resiliently below.
      const { data: activeSub, error: fetchErr } = await supabaseAdmin
        .from('merchant_subscriptions')
        .select('id, current_period_end, billing_type, razorpay_subscription_id')
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .gte('current_period_end', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) {
        console.error('[manage-subscription] Cancel fetch error:', fetchErr);
        throw fetchErr;
      }

      if (!activeSub) {
        return new Response(
          JSON.stringify({ error: 'No active subscription found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // ── Guard 1: block while live deals are running ──────────────────────
      // A deal (regular OR DOTD) counts as running while its end_date is in the
      // future. A merchant can't cancel while consumers can still see/claim them.
      const nowIso = new Date().toISOString();
      const { count: activeDeals } = await supabaseAdmin
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .gte('end_date', nowIso);
      if ((activeDeals || 0) > 0) {
        const n = activeDeals || 0;
        return new Response(JSON.stringify({
          success: false,
          error: 'active_deals',
          active_deals: n,
          message: `You have ${n} active deal${n === 1 ? '' : 's'} running. Please wait for ${n === 1 ? 'it' : 'them'} to complete before cancelling your subscription.`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // ── Guard 2: block within the one-cycle lock after a plan change ──────
      // Read the lock resiliently — tolerate the column not existing yet.
      let lockedUntil: string | null = null;
      try {
        const { data: lockRow } = await supabaseAdmin
          .from('merchant_subscriptions')
          .select('tier_change_locked_until')
          .eq('id', activeSub.id)
          .maybeSingle();
        lockedUntil = (lockRow as any)?.tier_change_locked_until ?? null;
      } catch { /* column may not exist yet */ }
      if (lockedUntil && new Date(lockedUntil) > new Date()) {
        const until = new Date(lockedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        return new Response(JSON.stringify({
          success: false,
          error: 'locked',
          locked_until: lockedUntil,
          message: `You changed your plan recently. Please wait one billing cycle — you can cancel on or after ${until}.`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // Dry-run: the cancel link calls this (check_only) to surface any guard
      // message on click without actually cancelling. Reaching here = no block.
      if (body.check_only) {
        return new Response(
          JSON.stringify({ success: true, can_cancel: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Cancel at Razorpay first (cancel_at_cycle_end so it stays active until
      // period end). If this fails, stop — don't mark a DB row cancelled while
      // Razorpay keeps charging. Legacy (non-Razorpay) subs skip straight to DB.
      if (activeSub.billing_type === 'razorpay' && activeSub.razorpay_subscription_id) {
        try {
          await cancelRazorpaySubscription(activeSub.razorpay_subscription_id as string, true);
        } catch (rzpErr: any) {
          console.error('[merchant-subscription] Razorpay cancel failed:', rzpErr?.message);
          return new Response(JSON.stringify({ error: rzpErr?.message || 'Could not cancel with Razorpay. Please try again.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 });
        }
      }

      // Mark subscription as cancelled at period end (keeps it active until current_period_end)
      const { error: updateErr } = await supabaseAdmin
        .from('merchant_subscriptions')
        .update({
          cancel_at_period_end: true,
          cancellation_reason: reason || null,
        })
        .eq('id', activeSub.id);

      if (updateErr) {
        console.error('[manage-subscription] Cancel update error:', updateErr);
        throw updateErr;
      }

      console.log(`[manage-subscription] Subscription ${activeSub.id} cancelled for merchant ${user.id}, reason: ${reason}`);

      // Confirm the cancellation (in-app + push) — they keep access until period end.
      const endLabel = activeSub.current_period_end
        ? new Date(activeSub.current_period_end as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'the end of your billing period';
      notifyMerchant(
        supabaseAdmin, user.id, 'subscription_cancelled',
        'Subscription cancelled',
        `Your plan is set to cancel on ${endLabel}. You'll keep full access until then.`,
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Subscription will be cancelled at the end of the current billing period.',
          current_period_end: activeSub.current_period_end,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'referral_credits') {
      // Referral free-month credits: 5 qualified referrals = 1 free month, with
      // carryover. available = floor(referrals/5) − months already granted.
      const FREE_MONTH_REFERRALS = 5;
      const [{ count: qualified }, { count: used }, { data: lastReward }] = await Promise.all([
        supabaseAdmin.from('merchant_referrals').select('*', { count: 'exact', head: true }).eq('referrer_id', user.id).eq('status', 'qualified'),
        supabaseAdmin.from('merchant_rewards_log').select('*', { count: 'exact', head: true }).eq('merchant_id', user.id).eq('reward_type', 'free_month'),
        supabaseAdmin.from('merchant_rewards_log').select('reward_month, created_at').eq('merchant_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      const q = qualified || 0;
      const earned = Math.floor(q / FREE_MONTH_REFERRALS);
      const available = Math.max(0, earned - (used || 0));
      return new Response(
        JSON.stringify({
          qualified_referrals: q,
          per_free_month: FREE_MONTH_REFERRALS,
          earned_months: earned,
          used_months: used || 0,
          available_months: available,
          referrals_to_next: FREE_MONTH_REFERRALS - (q % FREE_MONTH_REFERRALS),
          last_reward_at: lastReward?.created_at || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "check", "fetch", "create", "create_test_subscription", "cancel", "campaign_usage", or "referral_credits"' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error: any) {
    console.error('[manage-subscription] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
