/**
 * verify-play-purchase Edge Function
 *
 * Verifies a Google Play subscription purchase token via the Android Publisher API,
 * then activates/updates the merchant's subscription in the DB.
 *
 * Required Supabase secrets:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — JSON key for a service account with
 *     androidpublisher scope (Google Play Developer API)
 *   GOOGLE_PLAY_PACKAGE_NAME — e.g. "com.dealpro.merchant"
 */

// @ts-ignore
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

// ──────────────────────────────────────────────
//  Google OAuth2 — service account JWT → access token
// ──────────────────────────────────────────────

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT header + claims
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: Record<string, unknown>) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const unsignedToken = `${encode(header)}.${encode(claims)}`;

  // Import the RSA private key and sign
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signature}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Google OAuth token exchange failed: ${tokenRes.status} ${errBody}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// ──────────────────────────────────────────────
//  Google Play Developer API — verify subscription
// ──────────────────────────────────────────────

interface PlaySubscriptionResult {
  valid: boolean;
  expiryTimeMillis?: string;
  startTimeMillis?: string;
  paymentState?: number;      // 0=pending, 1=received, 2=free trial, 3=deferred
  cancelReason?: number;
  acknowledgementState?: number;
  obfuscatedExternalAccountId?: string;
  kind?: string;
  error?: string;
}

async function verifyPlaySubscription(
  accessToken: string,
  packageName: string,
  subscriptionId: string,
  purchaseToken: string
): Promise<PlaySubscriptionResult> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[verify-play-purchase] Google API error:', res.status, errBody);
    return { valid: false, error: `Google API error: ${res.status}` };
  }

  const data = await res.json();

  // A subscription is valid if expiryTimeMillis is in the future
  // or paymentState indicates free trial (2)
  const expiryMs = parseInt(data.expiryTimeMillis || '0', 10);
  const isValid = expiryMs > Date.now() || data.paymentState === 2;

  return {
    valid: isValid,
    expiryTimeMillis: data.expiryTimeMillis,
    startTimeMillis: data.startTimeMillis,
    paymentState: data.paymentState,
    cancelReason: data.cancelReason,
    acknowledgementState: data.acknowledgementState,
    obfuscatedExternalAccountId: data.obfuscatedExternalAccountId,
    kind: data.kind,
  };
}

// ──────────────────────────────────────────────
//  Edge Function handler
// ──────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const googleSaJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  const packageName = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME') || 'com.dealpro.merchant';

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ── 1. Authenticate the caller ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No token provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // ── 2. Parse request body ──
    const body = await req.json();
    const { merchant_id, purchaseToken: playToken, product_id, plan_name } = body;

    if (!merchant_id || !playToken || !product_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: merchant_id, purchaseToken, product_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Verify caller is the merchant (or allow service-to-service)
    if (user.id !== merchant_id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: merchant_id does not match authenticated user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log(`[verify-play-purchase] Verifying purchase for merchant ${merchant_id}, product: ${product_id}`);

    // ── 3. Verify with Google Play Developer API ──
    if (!googleSaJson) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Google service account not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const accessToken = await getGoogleAccessToken(googleSaJson);
    const verification = await verifyPlaySubscription(accessToken, packageName, product_id, playToken);

    if (!verification.valid) {
      console.error(`[verify-play-purchase] Invalid purchase for merchant ${merchant_id}:`, verification.error);
      return new Response(
        JSON.stringify({ success: false, error: 'Purchase verification failed', details: verification.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[verify-play-purchase] Purchase verified! paymentState: ${verification.paymentState}, expiry: ${verification.expiryTimeMillis}`);

    // ── 4. Look up the tier to get subscription_fee ──
    const tierKey = plan_name || productIdToTierKey(product_id);
    const { data: tierData, error: tierError } = await supabase
      .from('subscription_tiers')
      .select('id, tier_key, tier_name, subscription_fee')
      .eq('tier_key', tierKey)
      .single();

    if (tierError || !tierData) {
      console.error('[verify-play-purchase] Tier lookup failed for:', tierKey, tierError);
      return new Response(
        JSON.stringify({ error: `Unknown plan: ${tierKey}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // ── 5. Calculate dates ──
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 120);

    // Use Google's expiry if available, otherwise trial end
    const periodEnd = verification.expiryTimeMillis
      ? new Date(parseInt(verification.expiryTimeMillis, 10))
      : trialEnd;
    const periodStart = verification.startTimeMillis
      ? new Date(parseInt(verification.startTimeMillis, 10))
      : now;

    // ── 6. Deactivate any existing active subscriptions ──
    const { error: deactivateErr } = await supabase
      .from('merchant_subscriptions')
      .update({ status: 'cancelled', cancel_at_period_end: true })
      .eq('merchant_id', merchant_id)
      .eq('status', 'active');

    if (deactivateErr) {
      console.error('[verify-play-purchase] Deactivate old subs error:', deactivateErr);
    }

    // ── 7. Upsert subscription record ──
    const isFreeTrial = verification.paymentState === 2;

    const { data: subData, error: subError } = await supabase
      .from('merchant_subscriptions')
      .insert([{
        merchant_id: merchant_id,
        plan_name: tierData.tier_key,
        status: 'active',
        gateway_customer_id: verification.obfuscatedExternalAccountId || null,
        subscription_id: playToken,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        total_recurring_amount: tierData.subscription_fee,
        billing_type: 'google_play',
      }])
      .select()
      .single();

    if (subError) {
      console.error('[verify-play-purchase] Subscription insert error:', subError);
      throw subError;
    }

    // ── 8. Log to audit ──
    await supabase
      .from('subscription_audit_logs')
      .insert({
        subscription_id: subData.id,
        merchant_id: merchant_id,
        action_type: isFreeTrial ? 'google_play_trial_start' : 'google_play_purchase',
        new_plan_data: {
          tier_key: tierData.tier_key,
          tier_name: tierData.tier_name,
          subscription_fee: tierData.subscription_fee,
          purchase_token: playToken,
          product_id: product_id,
          payment_state: verification.paymentState,
          google_expiry: verification.expiryTimeMillis,
        },
        change_source: 'GOOGLE_PLAY',
        remarks: isFreeTrial
          ? `Free trial started via Google Play (120 days). Recurring: ₹${tierData.subscription_fee}/month after trial.`
          : `Subscription activated via Google Play. ₹${tierData.subscription_fee}/month.`,
      });

    console.log(`[verify-play-purchase] Subscription ${subData.id} created for merchant ${merchant_id}, tier: ${tierData.tier_name}, trial: ${isFreeTrial}`);

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subData.id,
        status: 'active',
        is_trial: isFreeTrial,
        trial_end: trialEnd.toISOString(),
        tier_name: tierData.tier_name,
        total_recurring_amount: tierData.subscription_fee,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[verify-play-purchase] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

function productIdToTierKey(productId: string): string {
  const map: Record<string, string> = {
    'dealpro_starter_monthly': 'starter',
    'dealpro_growth_monthly': 'growth',
    'dealpro_pro_monthly': 'pro',
  };
  return map[productId] || productId;
}
