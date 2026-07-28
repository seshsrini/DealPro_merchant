/**
 * process-referral-reward Edge Function
 *
 * Grants a referral reward: a near-free next billing cycle on the referrer's
 * active subscription. Invoked by the process_merchant_referral() SQL trigger
 * (via pg_net) when a referrer crosses the monthly referral threshold
 * (app_configs.referral_reward_threshold).
 *
 * Why an offer, not a cash payout: RazorpayX payouts aren't available to a
 * proprietorship, so instead of paying the merchant we discount ONE billing
 * cycle to Razorpay's ~₹1 minimum via a Subscription OFFER attached to their
 * existing subscription (schedule_change_at = cycle_end, so it applies to the
 * NEXT cycle and reverts afterwards). The offer is a single-cycle PERCENTAGE
 * discount created once in the Razorpay Dashboard — its id lives in
 * app_configs.referral_reward_offer_id ({"offer_id":"offer_xxx"}). A percentage
 * offer scales to every tier (₹199…₹2499), unlike a flat amount.
 *
 * Legacy (non-Razorpay) subscriptions fall back to grant_free_month() — a 30-day
 * DB period extension (their billing is our custom run, which honours the date).
 *
 * Idempotent: one reward per merchant per calendar month, keyed on
 * merchant_rewards_log (merchant_id, reward_month). The trigger also guards this,
 * but we re-check so a manual/retried invoke can't double-reward.
 *
 * Required Supabase secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (live).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// A Razorpay subscription OFFER is scoped to one payment method, so we keep two
// (UPI + Card) and attach the one that matches the subscription's mandate. This
// reads the method from the subscription's latest invoice payment.
async function getSubscriptionMethod(subId: string, auth: string): Promise<string> {
  try {
    const invRes = await fetch(
      `https://api.razorpay.com/v1/invoices?subscription_id=${subId}&count=10`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!invRes.ok) return 'unknown';
    const inv = await invRes.json();
    const paymentId = (inv.items || []).map((i: any) => i.payment_id).find((p: any) => !!p);
    if (!paymentId) return 'unknown';
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!payRes.ok) return 'unknown';
    const pay = await payRes.json();
    return pay.method || 'unknown'; // 'upi' | 'card' | …
  } catch {
    return 'unknown';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { merchant_id } = await req.json();
    if (!merchant_id) return json({ error: 'merchant_id is required' }, 400);

    // reward_month = first day of the current month (YYYY-MM-01) — the idempotency key.
    const now = new Date();
    const rewardMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;

    // Idempotency: at most one reward per merchant per month.
    const { data: already } = await supabase
      .from('merchant_rewards_log')
      .select('id')
      .eq('merchant_id', merchant_id)
      .eq('reward_month', rewardMonth)
      .maybeSingle();
    if (already) return json({ skipped: 'already rewarded this month' });

    // The referrer's active subscription.
    const { data: sub } = await supabase
      .from('merchant_subscriptions')
      .select('id, razorpay_subscription_id, billing_type, current_period_end, status')
      .eq('merchant_id', merchant_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return json({ skipped: 'no active subscription for merchant' });

    // Qualified referrals this month — for the audit log only.
    const { count: refCount } = await supabase
      .from('merchant_referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', merchant_id)
      .eq('status', 'qualified')
      .gte('qualified_at', rewardMonth);

    // ── Razorpay Autopay path: attach the one-cycle discount offer ──────────────
    if (sub.razorpay_subscription_id) {
      const keyId = Deno.env.get('RAZORPAY_KEY_ID');
      const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
      if (!keyId || !keySecret) return json({ error: 'Razorpay keys not configured' }, 500);
      const auth = btoa(`${keyId}:${keySecret}`);

      // Offer ids per payment method (a subscription offer is method-scoped):
      //   app_configs.referral_reward_offer_id = {"upi":"offer_...","card":"offer_..."}
      const { data: cfg } = await supabase
        .from('app_configs')
        .select('config_value')
        .eq('config_key', 'referral_reward_offer_id')
        .maybeSingle();
      const cv: any = cfg?.config_value || {};

      // Attach the offer matching the subscription's mandate method.
      const method = await getSubscriptionMethod(sub.razorpay_subscription_id, auth);
      const offerId: string | null =
        method === 'card' ? (cv.card || null)
        : method === 'upi' ? (cv.upi || null)
        : (cv.upi || cv.card || null); // unknown → best effort
      if (!offerId) {
        console.error(`[process-referral-reward] no offer configured for method=${method}`);
        return json({ error: `referral_reward_offer_id for method '${method}' not configured` }, 500);
      }

      // Attach the offer to the EXISTING subscription. schedule_change_at=cycle_end
      // → it discounts the NEXT billing cycle, then the subscription reverts to the
      // normal amount (the offer itself is configured single-cycle in the Dashboard).
      const rzpRes = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ offer_id: offerId, schedule_change_at: 'cycle_end', customer_notify: 1 }),
        },
      );
      if (!rzpRes.ok) {
        const errText = await rzpRes.text();
        console.error('[process-referral-reward] Razorpay offer attach failed:', rzpRes.status, errText.slice(0, 300));
        return json({ error: `Razorpay offer attach failed (${rzpRes.status}): ${errText}` }, 502);
      }

      // Audit + idempotency marker. days_extended=0 — it's a discount, not an extension.
      await supabase.from('merchant_rewards_log').insert({
        merchant_id,
        reward_type: 'free_month_offer',
        referral_count: refCount ?? 0,
        reward_month: rewardMonth,
        days_extended: 0,
        old_end_date: sub.current_period_end,
        new_end_date: sub.current_period_end,
      });

      console.log(`[process-referral-reward] Attached ${method} offer ${offerId} to ${sub.razorpay_subscription_id} (merchant ${merchant_id})`);
      return json({ success: true, method: 'razorpay_offer', payment_method: method, subscription_id: sub.razorpay_subscription_id, offer_id: offerId });
    }

    // ── Legacy (non-Razorpay) path: extend the DB period by 30 days ─────────────
    // grant_free_month() finds the active sub, extends trial_end/current_period_end
    // by 30 days, and logs to merchant_rewards_log itself.
    const { error: rpcErr } = await supabase.rpc('grant_free_month', { m_id: merchant_id });
    if (rpcErr) {
      console.error('[process-referral-reward] grant_free_month failed:', rpcErr.message);
      return json({ error: rpcErr.message }, 500);
    }
    return json({ success: true, method: 'grant_free_month' });

  } catch (err: any) {
    console.error('[process-referral-reward] Error:', err?.message);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
