/**
 * send-trial-email Edge Function
 *
 * Called by pg_cron (notify_upcoming_trial_ends) via net.http_post when
 * a merchant's trial is 3 days from expiry. Fetches merchant's business
 * name and email, sends push (FCM) + email (Resend), logs to
 * notification_logs, and updates last_notified_at on merchant_subscriptions.
 *
 * Expected JSON body from notify_upcoming_trial_ends():
 *   { merchant_id, subscription_id, total_recurring_amount, plan_name, tier_name, currency, trial_end }
 *
 * Required Supabase secrets:
 *   FIREBASE_SERVICE_ACCOUNT_JSON — Firebase Admin SDK service account key
 *   RESEND_API_KEY              — Resend.com API key for transactional email
 *   RESEND_FROM_EMAIL           — Verified sender (e.g. "DealPro <noreply@dealpro.in>")
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
//  Firebase Cloud Messaging — HTTP v1 API
// ──────────────────────────────────────────────

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
    throw new Error(`Firebase OAuth failed: ${tokenRes.status} ${errBody}`);
  }

  return (await tokenRes.json()).access_token;
}

async function sendFcmPush(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
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
          android: {
            priority: 'high',
            notification: { channel_id: 'dealpro_subscription', click_action: 'OPEN_SUBSCRIPTIONS' },
          },
          data: data || {},
        },
      }),
    }
  );

  if (!res.ok) {
    console.error('[send-trial-email] FCM failed:', res.status, await res.text());
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────
//  Resend Email API
// ──────────────────────────────────────────────

async function sendResendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html: htmlBody }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error('[send-trial-email] Resend failed:', res.status, errBody);
    return { success: false, error: errBody };
  }

  const data = await res.json();
  return { success: true, id: data.id };
}

function buildTrialExpiryEmailHtml(
  merchantName: string,
  amount: string,
  currency: string,
  planName: string,
  trialEndDate: string,
  nextBillingDate: string
): string {
  return `
    <!-- Preheader text (hidden, shown in email preview) -->
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      Your first payment of ${currency}${amount} will be processed soon.
    </div>

    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1e293b; background: #ffffff;">

      <!-- Logo -->
      <div style="text-align: center; margin-bottom: 28px;">
        <h1 style="font-size: 26px; font-weight: 800; margin: 0;">
          <span style="color: #0f172a;">Deal</span><span style="color: #FACA1B;">Pro</span>
        </h1>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">for Business</p>
      </div>

      <!-- Greeting -->
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Hi ${merchantName || 'there'},
      </p>

      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        We hope you've been enjoying the premium features of DealPro over the last few months! We're writing to let you know that your <strong>120-day free trial</strong> is set to conclude on <strong>${trialEndDate}</strong>.
      </p>

      <!-- What happens next -->
      <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 24px 0 12px;">
        What happens next?
      </h2>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Starting <strong>${nextBillingDate}</strong>, your preferred payment method on Google Play will be automatically billed <strong>${currency}${amount}</strong> for your monthly subscription.
      </p>

      <!-- Highlighted box -->
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #166534;">
          No action is required to continue using your premium dashboard, active campaigns, and analytics. Your service will remain uninterrupted.
        </p>
      </div>

      <!-- Managing your plan -->
      <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 24px 0 12px;">
        Managing your plan
      </h2>
      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        If you'd like to change your tier or manage your subscription, you can do so anytime via the
        <a href="https://play.google.com/store/account/subscriptions" style="color: #059669; text-decoration: underline; font-weight: 600;">Google Play Subscriptions Center</a>.
      </p>

      <!-- Closing -->
      <p style="font-size: 15px; line-height: 1.7; margin: 24px 0 8px;">
        Thank you for being a valued DealPro merchant. We look forward to helping you grow your business in the coming month!
      </p>

      <p style="font-size: 15px; line-height: 1.7; margin: 0 0 4px;">Best regards,</p>
      <p style="font-size: 15px; line-height: 1.7; margin: 0; font-weight: 600;">The DealPro Team</p>

      <!-- Footer -->
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
        DealPro for Business &bull; You're receiving this because you signed up for a DealPro merchant account.
      </p>
    </div>
  `;
}

// ──────────────────────────────────────────────
//  Dedup helper — check notification_logs
// ──────────────────────────────────────────────

async function wasAlreadySent(
  supabase: any,
  merchantId: string,
  notificationType: string,
  channel: string,
  withinDays: number = 7
): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);

  const { data } = await supabase
    .from('notification_logs')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('notification_type', notificationType)
    .eq('channel', channel)
    .eq('status', 'sent')
    .gte('created_at', cutoff.toISOString())
    .limit(1);

  return (data && data.length > 0);
}

async function logNotification(
  supabase: any,
  merchantId: string,
  notificationType: string,
  channel: string,
  recipient: string | null,
  title: string,
  body: string,
  status: 'sent' | 'failed' | 'skipped',
  errorMessage?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await supabase.from('notification_logs').insert({
    merchant_id: merchantId,
    notification_type: notificationType,
    channel,
    recipient,
    title,
    body,
    status,
    error_message: errorMessage || null,
    metadata: metadata || {},
  });
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
  const firebaseSaJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const resendFrom = Deno.env.get('RESEND_FROM_EMAIL') || 'DealPro <noreply@dealpro.in>';

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const {
      merchant_id,
      subscription_id,
      total_recurring_amount,
      plan_name,
      tier_name,
      currency,
      trial_end,
    } = body;

    if (!merchant_id) {
      return new Response(
        JSON.stringify({ error: 'Missing merchant_id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const amount = String(total_recurring_amount || 0);
    const curr = currency || '₹';
    const plan = tier_name || plan_name || 'your';
    const trialEndObj = trial_end ? new Date(trial_end) : null;
    const trialEndDate = trialEndObj
      ? trialEndObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '(upcoming)';
    // Next billing date = day after trial ends
    const nextBillingObj = trialEndObj ? new Date(trialEndObj.getTime() + 86400000) : null;
    const nextBillingDate = nextBillingObj
      ? nextBillingObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : trialEndDate;

    console.log(`[send-trial-email] merchant: ${merchant_id}, amount: ${curr}${amount}, plan: ${plan}, trial_end: ${trialEndDate}`);

    // ── Fetch merchant profile (email, phone, name) ──
    const { data: merchant, error: merchantErr } = await supabase
      .from('merchant_profiles')
      .select('full_name, store_name, email, phone, email_notification, push_notification')
      .eq('id', merchant_id)
      .single();

    if (merchantErr) {
      console.error('[send-trial-email] Merchant fetch error:', merchantErr);
      return new Response(
        JSON.stringify({ error: 'Merchant not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const merchantName = merchant.full_name || '';
    const emailSubject = 'Important: Your DealPro Premium trial ends in 3 days \u{1F680}';
    const notifTitle = 'Your DealPro trial ends in 3 days!';
    const notifBody = `Hi${merchantName ? ' ' + merchantName : ''}! Your DealPro trial ends in 3 days. Your subscription of ${curr}${amount} will be automatically processed via Google Play on ${trialEndDate}.`;

    let pushSent = 0;
    let pushFailed = 0;
    let emailSent = false;

    // ── 1. Push Notification via FCM ──
    if (firebaseSaJson && merchant.push_notification !== false) {
      const alreadySentPush = await wasAlreadySent(supabase, merchant_id, 'trial_expiry_3day', 'push');
      if (alreadySentPush) {
        console.log('[send-trial-email] Push already sent within 7 days, skipping');
        await logNotification(supabase, merchant_id, 'trial_expiry_3day', 'push', null, notifTitle, notifBody, 'skipped', 'Duplicate within 7 days');
      } else {
        const sa = JSON.parse(firebaseSaJson);
        const projectId = sa.project_id;

        const { data: tokens, error: tokenErr } = await supabase
          .from('fcm_tokens')
          .select('device_token')
          .eq('user_id', merchant_id)
          .eq('is_active', true);

        if (tokenErr) {
          console.error('[send-trial-email] FCM token fetch error:', tokenErr);
        } else if (tokens && tokens.length > 0) {
          const accessToken = await getFirebaseAccessToken(firebaseSaJson);

          for (const t of tokens) {
            const ok = await sendFcmPush(accessToken, projectId, t.device_token, notifTitle, notifBody, {
              type: 'trial_expiry',
              merchant_id,
              action: 'open_subscriptions',
            });

            await logNotification(
              supabase, merchant_id, 'trial_expiry_3day', 'push', t.device_token,
              notifTitle, notifBody, ok ? 'sent' : 'failed',
              ok ? undefined : 'FCM delivery failed',
              { plan, amount, currency: curr }
            );

            if (ok) pushSent++;
            else pushFailed++;
          }
        } else {
          console.log(`[send-trial-email] No FCM tokens for ${merchant_id}`);
          await logNotification(supabase, merchant_id, 'trial_expiry_3day', 'push', null, notifTitle, notifBody, 'skipped', 'No active FCM tokens');
        }
      }
    }

    // ── 2. Email via Resend ──
    if (resendApiKey && merchant.email && merchant.email_notification !== false) {
      const alreadySentEmail = await wasAlreadySent(supabase, merchant_id, 'trial_expiry_3day', 'email');
      if (alreadySentEmail) {
        console.log('[send-trial-email] Email already sent within 7 days, skipping');
        await logNotification(supabase, merchant_id, 'trial_expiry_3day', 'email', merchant.email, notifTitle, notifBody, 'skipped', 'Duplicate within 7 days');
      } else {
        const emailHtml = buildTrialExpiryEmailHtml(merchantName, amount, curr, plan, trialEndDate, nextBillingDate);
        const emailResult = await sendResendEmail(
          resendApiKey,
          resendFrom,
          merchant.email,
          emailSubject,
          emailHtml
        );

        await logNotification(
          supabase, merchant_id, 'trial_expiry_3day', 'email', merchant.email,
          notifTitle, notifBody,
          emailResult.success ? 'sent' : 'failed',
          emailResult.error,
          { resend_id: emailResult.id, plan, amount, currency: curr }
        );

        emailSent = emailResult.success;
        console.log(`[send-trial-email] Email ${emailResult.success ? 'sent' : 'failed'} to ${merchant.email}`);
      }
    } else if (!resendApiKey) {
      console.warn('[send-trial-email] RESEND_API_KEY not configured, skipping email');
    }

    // ── 3. Update last_notified_at on merchant_subscriptions ──
    // This prevents the cron job from sending duplicate warnings
    if (pushSent > 0 || emailSent) {
      const updateTarget = subscription_id
        ? supabase.from('merchant_subscriptions').update({ last_notified_at: new Date().toISOString() }).eq('id', subscription_id)
        : supabase.from('merchant_subscriptions').update({ last_notified_at: new Date().toISOString() }).eq('merchant_id', merchant_id).eq('status', 'active');

      const { error: updateErr } = await updateTarget;
      if (updateErr) {
        console.error('[send-trial-email] Failed to update last_notified_at:', updateErr);
      } else {
        console.log(`[send-trial-email] last_notified_at updated for subscription ${subscription_id || merchant_id}`);
      }
    }

    console.log(`[send-trial-email] Done for ${merchant_id}: push=${pushSent}/${pushFailed}, email=${emailSent}`);

    return new Response(
      JSON.stringify({
        success: true,
        push_sent: pushSent,
        push_failed: pushFailed,
        email_sent: emailSent,
        last_notified_at: (pushSent > 0 || emailSent) ? new Date().toISOString() : null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[send-trial-email] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
