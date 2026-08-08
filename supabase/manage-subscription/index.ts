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

    // Robust staff lockout: block a suspended/removed staff member (false only when
    // the user has staff rows but none active). Fail-open on null.
    const { data: __actorOk } = await supabaseAdmin.rpc('merchant_is_active_actor', { p_user_id: user.id });
    if (__actorOk === false) {
      return new Response(
        JSON.stringify({ error: 'ACCESS_DISABLED', message: 'Your access has been disabled by the store owner.' }),
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
        .select('status, plan_name, current_period_end, trial_end')
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

      // Also fetch store count (bypasses RLS via service_role)
      const { count: storeCount } = await supabaseAdmin
        .from('merchant_stores')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', user.id);

      // Check if trial has expired
      const trialEnd = data?.trial_end || data?.current_period_end;
      const trialExpired = trialEnd ? new Date(trialEnd) < new Date() : false;

      return new Response(
        JSON.stringify({
          hasActiveSubscription: !!data,
          subscription_status: data?.status,
          plan_name: data?.plan_name,
          trial_end: data?.trial_end,
          trialExpired,
          storeCount: storeCount ?? 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'fetch') {
      // Fetch current active subscription with tier details
      const { data, error } = await supabaseAdmin
        .from('merchant_subscriptions')
        .select('id, plan_name, status, current_period_start, current_period_end, cancel_at_period_end')
        .eq('merchant_id', user.id)
        .eq('status', 'active')
        .gte('current_period_end', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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

    if (action === 'campaign_usage') {
      // Get campaign usage for current calendar month
      // Get year and month from request body, or use server time as fallback
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
      const currentYear = year || new Date().getFullYear();
      const currentMonth = month !== undefined ? month : new Date().getMonth();

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
        .select('id, current_period_end')
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
      JSON.stringify({ error: 'Invalid action. Use "check", "fetch", "create", "cancel", or "campaign_usage"' }),
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
