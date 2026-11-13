/**
 * process-referral-reward Edge Function
 *
 * Merchant referral reward: every 5 referred merchants who sign up AND pay earn the referrer
 * one free month. Credits are all-time with carryover:
 *   available = floor(qualified referrals / threshold) − rewards already given
 * (SQL merchant_referral_credits, migration zzz_referral_paid_cumulative.sql).
 *
 * Called by razorpay-webhook (service-role key) on subscription.charged:
 *   • for the REFERRER when one of their referrals makes its first payment (it just qualified)
 *   • for the merchant who was just charged, so a credit that was waiting gets applied
 *
 * How the reward is given: Razorpay Autopay can't skip a cycle or charge ₹0, so a one-cycle
 * subscription OFFER (created once in the Razorpay Dashboard) is attached to the referrer's
 * subscription with schedule_change_at = cycle_end, i.e. it discounts their NEXT charge:
 *   monthly plan → ~100% off (the merchant pays ~₹1)       app_configs.referral_reward_offer_id.upi / .card
 *   yearly plan  → 1/12 off (worth one month)               …yearly_upi / .yearly_card
 * An offer is scoped to one payment method, so the one matching the mandate (UPI / card) is used.
 *
 * One credit at a time: if a reward was attached after the merchant's latest charge, it hasn't
 * been used yet, so nothing more is attached until the next charge. The reward row is written
 * BEFORE the Razorpay call (and removed if it fails) so two calls can't both attach.
 *
 * Required secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (live keys on PROD).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Payment method of the subscription's mandate, from its latest invoice payment.
async function getSubscriptionMethod(subId: string, auth: string): Promise<string> {
  try {
    const invRes = await fetch(`https://api.razorpay.com/v1/invoices?subscription_id=${subId}&count=10`, {
      headers: { Authorization: `Basic ${auth}` },
    });
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

  // Only our own backend (razorpay-webhook) may grant rewards.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!bearer || bearer !== serviceKey) return json({ error: 'Unauthorized' }, 401);

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const { merchant_id } = await req.json().catch(() => ({}));
    if (!merchant_id) return json({ error: 'merchant_id is required' }, 400);

    // 1. Any credit available?
    const { data: credits, error: credErr } = await supabase
      .rpc('merchant_referral_credits', { p_merchant: String(merchant_id) }).maybeSingle();
    if (credErr) return json({ error: `merchant_referral_credits: ${credErr.message}` }, 500);
    const c: any = credits || {};
    if (!c.available || c.available <= 0) {
      return json({ skipped: 'no credit available', qualified: c.qualified ?? 0, granted: c.granted ?? 0 });
    }

    // 2. The referrer's active Razorpay subscription and its plan frequency.
    const { data: sub } = await supabase
      .from('merchant_subscriptions')
      .select('id, razorpay_subscription_id, plan_name, current_period_end, status')
      .eq('merchant_id', merchant_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub?.razorpay_subscription_id) {
      return json({ skipped: 'no active Razorpay subscription; the credit waits for their next payment' });
    }
    const { data: tier } = await supabase
      .from('subscription_tiers').select('billing_frequency').eq('tier_key', sub.plan_name).maybeSingle();
    const yearly = tier?.billing_frequency === 'yearly';

    // 3. One credit at a time: a reward attached after their latest charge is still unused.
    const [{ data: lastReward }, { data: lastPay }] = await Promise.all([
      supabase.from('merchant_rewards_log').select('created_at')
        .eq('merchant_id', merchant_id).in('reward_type', ['free_month', 'free_month_offer'])
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('merchant_payments').select('created_at')
        .eq('merchant_id', merchant_id).eq('payment_status', 'captured')
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (lastReward?.created_at && (!lastPay?.created_at || new Date(lastReward.created_at) > new Date(lastPay.created_at))) {
      return json({ skipped: 'a reward is already waiting for their next charge', available: c.available });
    }

    // 4. The offer for this plan frequency and payment method.
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) return json({ error: 'Razorpay keys not configured' }, 500);
    const auth = btoa(`${keyId}:${keySecret}`);
    const { data: cfg } = await supabase
      .from('app_configs').select('config_value').eq('config_key', 'referral_reward_offer_id').maybeSingle();
    const cv: any = cfg?.config_value || {};
    const method = await getSubscriptionMethod(sub.razorpay_subscription_id, auth);
    const upi = yearly ? cv.yearly_upi : cv.upi;
    const card = yearly ? cv.yearly_card : cv.card;
    const offerId: string | null = method === 'card' ? (card || null) : method === 'upi' ? (upi || null) : (upi || card || null);
    if (!offerId) {
      console.error(`[process-referral-reward] no ${yearly ? 'yearly' : 'monthly'} offer configured for method=${method}`);
      return json({ error: `No ${yearly ? 'yearly' : 'monthly'} referral offer configured for '${method}' (app_configs.referral_reward_offer_id)` }, 500);
    }

    // 5. Claim the credit first (so a parallel call sees it), then attach the offer.
    const now = new Date();
    const rewardMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const { data: claim, error: claimErr } = await supabase.from('merchant_rewards_log').insert({
      merchant_id,
      reward_type: 'free_month_offer',
      referral_count: c.qualified ?? 0,
      reward_month: rewardMonth,
      days_extended: 0,
      old_end_date: sub.current_period_end,
      new_end_date: sub.current_period_end,
    }).select('id').single();
    if (claimErr) return json({ error: `could not record the reward: ${claimErr.message}` }, 500);

    const rzpRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offerId, schedule_change_at: 'cycle_end', customer_notify: 1 }),
    });
    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      await supabase.from('merchant_rewards_log').delete().eq('id', claim.id); // credit stays available
      console.error('[process-referral-reward] Razorpay offer attach failed:', rzpRes.status, errText.slice(0, 300));
      return json({ error: `Razorpay offer attach failed (${rzpRes.status}): ${errText}` }, 502);
    }

    console.log(`[process-referral-reward] ${yearly ? 'yearly' : 'monthly'} ${method} offer ${offerId} → ${sub.razorpay_subscription_id} (merchant ${merchant_id}, credits ${c.available} → ${c.available - 1})`);
    return json({
      success: true, plan: yearly ? 'yearly' : 'monthly', payment_method: method,
      subscription_id: sub.razorpay_subscription_id, offer_id: offerId, credits_left: c.available - 1,
    });
  } catch (err: any) {
    console.error('[process-referral-reward] Error:', err?.message);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
