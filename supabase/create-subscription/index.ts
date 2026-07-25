import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const adminClient = createClient(supabaseUrl, serviceKey);

    // SECURITY: deployed with --no-verify-jwt. This endpoint creates/cancels
    // subscriptions, so verify the caller's JWT and act ONLY on their own
    // account — the merchant id is taken from the VERIFIED token, never from the
    // body (which previously let anyone grant any merchant a free trial or
    // cancel a competitor). In production this path is unused — signup takes
    // payment via Razorpay on StepPayment; it remains only behind the dev-only
    // VITE_ALLOW_TEST_SUBSCRIPTION bypass, where the tester is logged in, so a
    // valid token is always present.
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { tier_id, tier_key, tier_name } = body;
    const merchantId = user.id; // force to the verified caller; ignore any body merchantId

    if (!tier_key || !tier_name) {
      return new Response(
        JSON.stringify({ error: 'tier_key and tier_name are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify merchant exists
    const { data: profile } = await adminClient
      .from('merchant_profiles')
      .select('id')
      .eq('id', merchantId)
      .eq('role', 'merchant')
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Merchant not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Trial length from the tier. NO free trial by default — merchants pay from
    // day one. Only a tier that EXPLICITLY sets trial_period_days > 0 gets one.
    // (The old default was 120 days, and `if (tier?.trial_period_days)` treated the
    // intended 0 as "unset" and kept 120 — so every subscription silently got a
    // 120-day free trial. Use ?? and an explicit >0 guard to avoid both traps.)
    let trialDays = 0;
    if (tier_id) {
      const { data: tier } = await adminClient
        .from('subscription_tiers')
        .select('trial_period_days')
        .eq('id', tier_id)
        .maybeSingle();
      const t = tier?.trial_period_days;
      if (typeof t === 'number' && t > 0) trialDays = t;
    }

    // Deactivate any existing active subscriptions
    await adminClient
      .from('merchant_subscriptions')
      .update({ status: 'cancelled', cancel_at_period_end: true })
      .eq('merchant_id', merchantId)
      .eq('status', 'active');

    // No trial (trialDays 0) → billing starts today: the paid period runs from now.
    // With a trial, the paid period starts when the trial ends.
    const now = new Date();
    const trialEnd = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;
    const periodStart = trialEnd ?? now;
    const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { data: sub, error: insertErr } = await adminClient
      .from('merchant_subscriptions')
      .insert({
        merchant_id: merchantId,
        tier_id: tier_id || null,
        plan_name: tier_key,
        status: 'active',
        billing_type: 'manual',
        trial_end: trialEnd ? trialEnd.toISOString() : null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[create-subscription] Insert error:', insertErr.message);
      return new Response(
        JSON.stringify({ error: 'Failed to create subscription.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[create-subscription] Created subscription for ${merchantId}: ${tier_name}, ${trialEnd ? 'trial ends ' + trialEnd.toISOString() : 'no trial (billing from day one)'}`);

    return new Response(
      JSON.stringify({
        success: true,
        isTrialing: trialDays > 0,
        subscription: sub,
        subscriptionId: sub.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[create-subscription] Error:', err.message);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
