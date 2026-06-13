// web-login-request — UNAUTHENTICATED, called by the web app (vedicjaalam.com/merchant/).
//
//   action: 'request' → merchant enters phone; create a pending approval request.
//   action: 'claim'   → web polls with the secret nonce; once the mobile app has
//                        approved, return the magic-link token_hash + profile so
//                        the web client can verifyOtp() into a session.
//
// Pairs with `web-login-approve` (authenticated, mobile-side). The session is
// minted exactly like login-merchant (admin.generateLink magiclink → token_hash
// → client supabase.auth.verifyOtp).

// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const REQUEST_TTL_MS = 2 * 60 * 1000; // a pending request is valid for 2 minutes

function normalizePhone(phone: string): string {
  const clean = (phone || '').replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('91')) return clean.substring(2);
  return clean;
}

// ──────────────────────────────────────────────────────────────────────────────
//  Firebase Cloud Messaging — HTTP v1 (instant approval prompt on the phone).
//  Mechanism mirrors send-trial-email: service-account JWT → OAuth token → send.
// ──────────────────────────────────────────────────────────────────────────────
async function getFirebaseAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
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
    'pkcs8', keyBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsignedToken),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${unsignedToken}.${signature}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) throw new Error(`Firebase OAuth failed: ${tokenRes.status} ${await tokenRes.text()}`);
  return (await tokenRes.json()).access_token;
}

async function sendFcmPush(
  accessToken: string, projectId: string, deviceToken: string,
  title: string, body: string, data?: Record<string, string>,
): Promise<boolean> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          android: { priority: 'high', notification: { channel_id: 'dealpro_weblogin' } },
          data: data || {},
        },
      }),
    },
  );
  if (!res.ok) { console.error('[web-login-request] FCM failed:', res.status, await res.text()); return false; }
  return true;
}

// Best-effort instant push to the merchant's logged-in phone(s) so the approval
// modal appears immediately. The app's 5s foreground poll is the fallback, so a
// push failure here is non-fatal.
async function notifyMerchantOfWebLogin(
  admin: any, merchantId: string, requestCode: string, requesterLabel: string,
): Promise<void> {
  try {
    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!saJson) { console.warn('[web-login-request] FIREBASE_SERVICE_ACCOUNT_JSON not set — skipping push'); return; }
    const { data: tokens } = await admin
      .from('fcm_tokens')
      .select('device_token')
      .eq('user_id', merchantId)
      .eq('is_active', true);
    if (!tokens || tokens.length === 0) { console.log('[web-login-request] no active fcm tokens — relying on poll'); return; }
    const projectId = JSON.parse(saJson).project_id;
    const accessToken = await getFirebaseAccessToken(saJson);
    for (const t of tokens) {
      await sendFcmPush(
        accessToken, projectId, t.device_token,
        'Approve web sign-in?',
        `Tap to approve sign-in #${requestCode} from ${requesterLabel}.`,
        { type: 'web_login_approval', request_code: requestCode },
      );
    }
  } catch (e) {
    console.error('[web-login-request] push notify failed (non-fatal):', (e as Error).message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const action = body.action;

    // ─────────────────────────────────────────────────────────────────────────
    // REQUEST — create a pending login request for a known merchant phone.
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'request') {
      const phone = normalizePhone(body.phone);
      if (!phone) return json({ error: 'Phone number required' }, 400);

      // Web is for EXISTING merchants only — no auto-register (signup is mobile-only).
      const { data: profile, error: lookupErr } = await admin
        .from('merchant_profiles')
        .select('id, phone')
        .eq('phone', phone)
        .maybeSingle();

      if (lookupErr) return json({ error: 'Lookup failed' }, 500);
      if (!profile) {
        return json({ error: 'no_account', message: 'No DealPro merchant account for this number. Please sign up in the mobile app.' }, 404);
      }

      const requestCode = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
      const claimNonce = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + REQUEST_TTL_MS).toISOString();
      const requesterLabel = (body.requester_label || '').toString().slice(0, 80) || 'Web browser';

      const { data: inserted, error: insErr } = await admin
        .from('web_login_requests')
        .insert({
          merchant_id: profile.id,
          phone,
          request_code: requestCode,
          claim_nonce: claimNonce,
          status: 'pending',
          requester_label: requesterLabel,
          expires_at: expiresAt,
        })
        .select('id')
        .single();

      if (insErr || !inserted) {
        console.error('[web-login-request] insert failed:', insErr?.message);
        return json({ error: 'Could not start login request' }, 500);
      }

      // Instant push to the merchant's phone so the approval modal pops without
      // waiting on the app's foreground poll. Awaited (Deno may drop pending work
      // after the response) but wrapped so a push failure never blocks login.
      await notifyMerchantOfWebLogin(admin, profile.id, requestCode, requesterLabel);

      return json({ request_id: inserted.id, request_code: requestCode, claim_nonce: claimNonce, expires_at: expiresAt });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CLAIM — web polls with (request_id, claim_nonce); returns the session
    // material once the mobile app has approved.
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'claim') {
      const { request_id, claim_nonce } = body;
      if (!request_id || !claim_nonce) return json({ error: 'Missing request_id or claim_nonce' }, 400);

      const { data: row } = await admin
        .from('web_login_requests')
        .select('*')
        .eq('id', request_id)
        .maybeSingle();

      if (!row) return json({ error: 'Request not found' }, 404);
      if (row.claim_nonce !== claim_nonce) return json({ error: 'forbidden' }, 403);

      // Expiry check (covers rows still marked pending past their TTL).
      if (new Date(row.expires_at).getTime() < Date.now() && row.status !== 'claimed') {
        if (row.status === 'pending') {
          await admin.from('web_login_requests').update({ status: 'expired' }).eq('id', row.id);
        }
        return json({ status: 'expired' });
      }

      if (row.status === 'pending') return json({ status: 'pending' });
      if (row.status === 'denied') return json({ status: 'denied' });
      if (row.status === 'claimed') return json({ status: 'expired' }); // single-use already consumed

      if (row.status === 'approved') {
        if (!row.token_hash) return json({ status: 'pending' }); // approval in flight

        // Re-fetch the merchant profile fresh, plus subscription/store info, so the
        // web client gets the same payload shape login-merchant returns.
        const { data: profile } = await admin
          .from('merchant_profiles')
          .select('*')
          .eq('id', row.merchant_id)
          .maybeSingle();

        const nowIso = new Date().toISOString();
        const { data: activeSub } = await admin
          .from('merchant_subscriptions')
          .select('id, status, plan_name, current_period_end, trial_end')
          .eq('merchant_id', row.merchant_id)
          .eq('status', 'active')
          .gte('current_period_end', nowIso)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { count: storeCount } = await admin
          .from('merchant_stores')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', row.merchant_id);

        const trialEnd = activeSub?.trial_end || activeSub?.current_period_end;
        const trialExpired = trialEnd ? new Date(trialEnd) < new Date() : false;

        // Consume the request (single-use): clear token_hash, mark claimed.
        await admin
          .from('web_login_requests')
          .update({ status: 'claimed', token_hash: null })
          .eq('id', row.id);

        return json({
          status: 'approved',
          user: profile,
          token_hash: row.token_hash,
          subscription: {
            hasActiveSubscription: !!activeSub,
            subscription_status: activeSub?.status,
            plan_name: activeSub?.plan_name,
            trial_end: activeSub?.trial_end,
            trialExpired,
            storeCount: storeCount ?? 0,
          },
        });
      }

      return json({ status: row.status });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err: any) {
    console.error('[web-login-request] error:', err?.message);
    return json({ error: 'Internal server error' }, 500);
  }
});
