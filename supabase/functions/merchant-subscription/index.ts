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
      // Check if merchant has active subscription
      const { data, error } = await supabaseAdmin
        .from('merchant_subscriptions')
        .select('status, plan_name, current_period_end')
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .gte('current_period_end', new Date().toISOString())
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

      // Enforce the change-lock (best-effort; tolerate a missing column).
      let lockedUntil: string | null = null;
      try {
        const { data: lockRow } = await supabaseAdmin
          .from('merchant_subscriptions')
          .select('tier_change_locked_until')
          .eq('id', sub.id)
          .maybeSingle();
        lockedUntil = (lockRow as any)?.tier_change_locked_until ?? null;
      } catch { /* column may not exist yet */ }
      if (lockedUntil && new Date(lockedUntil) > new Date()) {
        const until = new Date(lockedUntil);
        return new Response(JSON.stringify({
          success: false,
          error: 'locked',
          locked_until: lockedUntil,
          message: `You changed your plan recently. You can change it again after ${until.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

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

      // Lock for at least one billing month: the later of next billing or +30d.
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 86400000);
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : in30;
      const lockUntil = (periodEnd > in30 ? periodEnd : in30).toISOString();

      // ── Razorpay-managed subscription: drive the change through Razorpay ─────
      if (isRazorpaySub) {
        if (!newTier.razorpay_plan_id) {
          return new Response(JSON.stringify({ error: "That plan isn't available for online subscription yet." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        // Razorpay can't swap a plan across billing intervals on the same
        // subscription. Tell the app to cancel + re-subscribe to the new plan
        // (it opens web checkout; verify-subscription cancels the old sub once
        // the new one is active). No lock and no DB mutation here.
        if ((curTier?.billing_frequency || null) !== (newTier.billing_frequency || null)) {
          return new Response(JSON.stringify({
            success: true,
            resubscribe: true,
            tier_key: newTier.tier_key,
            tier_name: newTier.tier_name,
            message: `Switching to ${newTier.billing_frequency} billing needs a fresh subscription. Continue to set up ${newTier.tier_name}.`,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
        }

        // Same frequency → PATCH the plan. Upgrade applies now (prorated charge
        // + instant benefit); downgrade applies at cycle end (no mid-cycle charge).
        try {
          await updateRazorpaySubscriptionPlan(
            sub.razorpay_subscription_id as string,
            newTier.razorpay_plan_id,
            isUpgrade ? 'now' : 'cycle_end',
          );
        } catch (rzpErr: any) {
          console.error('[merchant-subscription] Razorpay plan update failed:', rzpErr?.message);
          return new Response(JSON.stringify({ error: rzpErr?.message || 'Could not update your plan with Razorpay. Please try again.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 });
        }
      }

      const patch: Record<string, unknown> = isUpgrade
        // Instant upgrade: switch the plan + go-forward amount now. For Razorpay
        // subs the prorated charge was just raised; subscription.charged/updated
        // webhooks reconcile current_period_end. For legacy subs the billing run
        // applies the new rate at the next cycle.
        ? { plan_name: newTier.tier_key, total_recurring_amount: recurringAmount, pending_tier_id: null, pending_plan_name: null, pending_amount: null, pending_effective_date: null }
        : { pending_tier_id: newTier.id, pending_plan_name: newTier.tier_key, pending_amount: recurringAmount, pending_effective_date: sub.current_period_end };
      patch.tier_change_locked_until = lockUntil;
      patch.updated_at = now.toISOString();

      let { error: updErr } = await supabaseAdmin.from('merchant_subscriptions').update(patch).eq('id', sub.id);
      // Resilience: if the lock column isn't present yet, save without it.
      if (updErr && /tier_change_locked_until/i.test(updErr.message || '')) {
        delete patch.tier_change_locked_until;
        ({ error: updErr } = await supabaseAdmin.from('merchant_subscriptions').update(patch).eq('id', sub.id));
      }
      if (updErr) throw updErr;

      return new Response(JSON.stringify({
        success: true,
        upgraded: isUpgrade,
        locked_until: lockUntil,
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
      // Campaign / DOTD limits reset on the 1st of each month at 12:00 AM IST
      // (UTC+5:30). The Edge Function runtime is UTC, so naively reading
      // new Date().getMonth() rolls the period over at 5:30 AM IST instead of
      // midnight IST — making merchants wait an extra 5.5 hours past their
      // expected reset. Default to IST when the client doesn't specify.
      const { year, month } = body;

      // 1. Get merchant's active subscription and tier limits
      const { data: subscription, error: subError } = await supabaseAdmin
        .from('merchant_subscriptions')
        .select('plan_name')
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

      // 3. Count campaigns active during the current calendar month
      // A campaign is "active this month" if its date range overlaps with the month:
      //   start_date <= end of month AND (end_date >= start of month OR end_date is null)
      // IST = UTC + 5h30m. Shift now() into IST before reading year/month so
      // the period boundary lines up with midnight IST on the 1st.
      const istNow = new Date(Date.now() + 5.5 * 3600 * 1000);
      const currentYear = year || istNow.getUTCFullYear();
      const currentMonth = month !== undefined ? month : istNow.getUTCMonth();

      const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]; // last day of month

      console.log('[manage-subscription] Campaign count query params:', {
        merchant_id: user.id,
        startOfMonth,
        endOfMonth,
        year: currentYear,
        month: currentMonth
      });

      // Count regular campaigns (exclude DOTD) active during this month
      const { count: campaignsCount, error: campaignsError } = await supabaseAdmin
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', user.id)
        .or('is_deal_of_the_day.is.null,is_deal_of_the_day.eq.false')
        .lte('start_date', endOfMonth)
        .or(`end_date.gte.${startOfMonth},end_date.is.null`);

      console.log('[manage-subscription] Campaign count result:', { campaignsCount, error: campaignsError });

      if (campaignsError) {
        console.error('[manage-subscription] Campaigns count error:', campaignsError);
        throw campaignsError;
      }

      // 4. Count DOTD campaigns active during this month
      const { count: dotdCount, error: dotdError } = await supabaseAdmin
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', user.id)
        .eq('is_deal_of_the_day', true)
        .lte('start_date', endOfMonth)
        .or(`end_date.gte.${startOfMonth},end_date.is.null`);

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
          has_subscription: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'cancel') {
      const { reason } = body;

      // Find the active subscription
      const { data: activeSub, error: fetchErr } = await supabaseAdmin
        .from('merchant_subscriptions')
        .select('id, current_period_end, billing_type, razorpay_subscription_id, tier_change_locked_until')
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
      // A merchant can't cancel while consumers can still see/claim their deals.
      const nowIso = new Date().toISOString();
      const { count: activeDeals } = await supabaseAdmin
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .or(`end_date.gte.${nowIso},end_date.is.null`);
      if ((activeDeals || 0) > 0) {
        const n = activeDeals || 0;
        return new Response(JSON.stringify({
          success: false,
          error: 'active_deals',
          active_deals: n,
          message: `You have ${n} active deal${n === 1 ? '' : 's'} running. Please end ${n === 1 ? 'it' : 'them'} (or wait for ${n === 1 ? 'it' : 'them'} to expire) before cancelling your subscription.`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }

      // ── Guard 2: block within the one-cycle lock after a plan change ──────
      const lockedUntil = (activeSub as any).tier_change_locked_until as string | null;
      if (lockedUntil && new Date(lockedUntil) > new Date()) {
        const until = new Date(lockedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        return new Response(JSON.stringify({
          success: false,
          error: 'locked',
          locked_until: lockedUntil,
          message: `You changed your plan recently. Please wait one billing cycle — you can cancel on or after ${until}.`,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
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

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Subscription will be cancelled at the end of the current billing period.',
          current_period_end: activeSub.current_period_end,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "check", "fetch", "create", "create_test_subscription", "cancel", or "campaign_usage"' }),
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
