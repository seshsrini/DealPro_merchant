// send-merchant-push — send an FCM push to a merchant's device(s).
// Server-to-server only (caller must present the service-role key).
// Body: { merchant_id, title, body, data? }
// Reuses the FCM HTTP v1 mechanism (service-account JWT → access token → send).

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
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function getFirebaseAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const encode = (obj: Record<string, unknown>) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${encode(header)}.${encode(claims)}`;
  const pemBody = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsigned));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${signature}`,
  });
  if (!res.ok) throw new Error(`Firebase OAuth ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function sendFcmPush(accessToken: string, projectId: string, deviceToken: string, title: string, body: string, data?: Record<string, string>): Promise<boolean> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token: deviceToken, notification: { title, body }, android: { priority: 'high', notification: { channel_id: 'dealpro_billing' } }, data: data || {} } }),
  });
  if (!res.ok) { console.error('[send-merchant-push] FCM failed:', res.status, await res.text()); return false; }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if ((req.headers.get('Authorization') || '') !== `Bearer ${serviceKey}`) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { merchant_id, title, body, data } = await req.json();
    if (!merchant_id || !title) return json({ error: 'merchant_id and title required' }, 400);

    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!saJson) return json({ skipped: 'no firebase config' });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const { data: tokens } = await supabase.from('fcm_tokens').select('device_token').eq('user_id', merchant_id).eq('is_active', true);
    if (!tokens || tokens.length === 0) return json({ sent: 0 });

    const projectId = JSON.parse(saJson).project_id;
    const accessToken = await getFirebaseAccessToken(saJson);
    let sent = 0;
    for (const t of tokens) {
      if (await sendFcmPush(accessToken, projectId, t.device_token, title, body || '', data || {})) sent += 1;
    }
    return json({ sent });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
