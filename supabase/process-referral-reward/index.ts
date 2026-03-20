/**
 * process-referral-reward Edge Function
 *
 * Called by the check_referral_reward() SQL trigger via pg_net when a merchant
 * hits the referral threshold (e.g., 20 qualified referrals in a calendar month).
 *
 * 1. Defers Google Play billing by 30 days (purchases.subscriptions.defer)
 * 2. Updates merchant_subscriptions in Supabase
 * 3. Logs the reward in merchant_rewards_log
 * 4. Sends a congratulatory push notification / in-app message
 *
 * Required Supabase secrets:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — JSON key for androidpublisher scope
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
//  Google Play — Defer subscription billing
// ──────────────────────────────────────────────

async function deferPlaySubscription(
  accessToken: string,
  packageName: string,
  subscriptionId: string,
  purchaseToken: string,
  newExpiryTimeMillis: number
): Promise<{ success: boolean; newExpiryTimeMillis?: string; error?: string }> {
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}:defer`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deferralInfo: {
        expectedExpiryTimeMillis: String(Date.now() + 86400000), // rough current expiry
        desiredExpiryTimeMillis: String(newExpiryTimeMillis),
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[process-referral-reward] Google defer API error:', res.status, errBody);
    return { success: false, error: `Google API ${res.status}: ${errBody}` };
  }

  const data = await res.json();
  return {
    success: true,
    newExpiryTimeMillis: data.newExpiryTimeMillis,
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
    const body = await req.json();
    const { merchant_id, subscription_id: subDbId } = body;

    if (!merchant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing merchant_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[process-referral-reward] Processing reward for merchant ${merchant_id}`);

    // ── 1. Fetch the active subscription ──
    const { data: sub, error: subErr } = await supabase
      .from('merchant_subscriptions')
      .select('*')
      .eq('merchant_id', merchant_id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subErr || !sub) {
      console.error('[process-referral-reward] No active subscription:', subErr);
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const currentEnd = new Date(sub.trial_end || sub.current_period_end || Date.now());
    const newEnd = new Date(currentEnd.getTime() + 30 * 86400000); // +30 days
    const isInTrial = sub.trial_end && new Date(sub.trial_end) > new Date();

    // ── 2. Defer Google Play billing (if Google Play subscription) ──
    let googleDeferred = false;
    if (sub.billing_type === 'google_play' && sub.subscription_id && googleSaJson) {
      try {
        const accessToken = await getGoogleAccessToken(googleSaJson);

        // Determine the Google product ID from plan_name
        const productId = tierKeyToProductId(sub.plan_name);

        const deferResult = await deferPlaySubscription(
          accessToken,
          packageName,
          productId,
          sub.subscription_id,  // this is the purchaseToken
          newEnd.getTime()
        );

        if (deferResult.success) {
          googleDeferred = true;
          console.log(`[process-referral-reward] Google Play billing deferred to ${newEnd.toISOString()}`);
        } else {
          console.error('[process-referral-reward] Google defer failed:', deferResult.error);
          // Continue anyway — update our DB even if Google defer fails
          // (merchant still gets the local extension; Google sync can be retried)
        }
      } catch (err: any) {
        console.error('[process-referral-reward] Google defer error:', err.message);
      }
    }

    // ── 3. Update merchant_subscriptions ──
    const updateFields: Record<string, any> = {
      current_period_end: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isInTrial) {
      updateFields.trial_end = newEnd.toISOString();
    }

    const { error: updateErr } = await supabase
      .from('merchant_subscriptions')
      .update(updateFields)
      .eq('id', sub.id);

    if (updateErr) {
      console.error('[process-referral-reward] Subscription update error:', updateErr);
      throw updateErr;
    }

    // ── 4. Log to merchant_rewards_log ──
    await supabase
      .from('merchant_rewards_log')
      .insert({
        merchant_id,
        reward_type: 'free_month',
        referral_count: 20,
        reward_month: new Date().toISOString().slice(0, 10).replace(/-\d{2}$/, '-01'), // first of month
        days_extended: 30,
        old_end_date: currentEnd.toISOString(),
        new_end_date: newEnd.toISOString(),
      });

    // ── 5. Send in-app notification ──
    try {
      await supabase
        .from('notification_logs')
        .insert({
          merchant_id,
          notification_type: 'referral_reward',
          channel: 'in_app',
          subject: 'You earned a free month!',
          body: `Amazing! You hit 20 referrals this month. Your next DealPro bill has been pushed back by 30 days!`,
          status: 'sent',
        });
    } catch (notifErr: any) {
      console.error('[process-referral-reward] Notification insert error:', notifErr.message);
      // Non-fatal — reward still granted
    }

    console.log(`[process-referral-reward] Reward granted for merchant ${merchant_id}. Extended to ${newEnd.toISOString()}. Google deferred: ${googleDeferred}`);

    return new Response(
      JSON.stringify({
        success: true,
        merchant_id,
        old_end: currentEnd.toISOString(),
        new_end: newEnd.toISOString(),
        google_play_deferred: googleDeferred,
        days_extended: 30,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[process-referral-reward] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// ──────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────

function tierKeyToProductId(tierKey: string): string {
  const map: Record<string, string> = {
    'starter': 'dealpro_starter_monthly',
    'growth': 'dealpro_growth_monthly',
    'pro': 'dealpro_pro_monthly',
  };
  return map[tierKey] || `dealpro_${tierKey}_monthly`;
}
