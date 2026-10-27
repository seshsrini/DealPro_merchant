// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined; };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Merchant business logo — content-checked, uploaded and saved in one place.
//
//   POST { action: 'set', image: <base64 JPEG/PNG/WebP, ≤ ~1 MB> } → { logo_url }
//   POST { action: 'remove' }                                     → { logo_url: null }
//
// Content check is SERVER-SIDE and FAILS CLOSED: an image is only accepted when
// Gemini answers "not flagged". A safety block, an unreadable answer or the
// checker being unavailable all reject the upload (the client asks to retry).
//
// Stored at Cloudinary public_id dealpro-logos/merchant_<merchantId> with
// overwrite + invalidate, so replacing a logo leaves no orphan; the returned
// secure_url carries a new version, so devices don't keep a cached old logo.
// Only the merchant owner can change it — not staff acting for the owner.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });

const MAX_BASE64_CHARS = 1_400_000; // ≈ 1 MB image
const GEMINI_ATTEMPTS = ['gemini-flash-latest', 'gemini-3-flash-preview', 'gemini-flash-lite-latest'];

const MODERATION_PROMPT = `You are a strict content moderator for "DealFynd", a family-friendly Indian local-deals app.
A shop owner wants to use this image as their BUSINESS LOGO, shown publicly to all shoppers.
Flag the image (flagged=true) if it contains ANY of: nudity or sexual content, suggestive poses,
violence, blood or gore, weapons used threateningly, hate symbols or extremist imagery, drugs or
drug paraphernalia, obscene gestures, profanity or offensive text, or anything clearly inappropriate
for a public, all-ages business listing. Ordinary logos, shop fronts, products, food, text or
abstract designs are fine (flagged=false).
Return JSON: {"flagged": boolean, "reason": "short reason for the shop owner, empty if not flagged"}`;

type Verdict = { ok: true } | { ok: false; reason: string; retry: boolean };

async function moderate(base64: string, mime: string): Promise<Verdict> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return { ok: false, retry: true, reason: 'Image check is not available right now.' };
  const body = JSON.stringify({
    contents: [{ parts: [{ text: MODERATION_PROMPT }, { inline_data: { mime_type: mime, data: base64 } }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });
  for (const model of GEMINI_ATTEMPTS) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
      );
      if (resp.status === 404) continue; // model not served for this key — try the next
      if (!resp.ok) { console.warn('[set-merchant-logo] Gemini', model, resp.status); continue; }
      const data = await resp.json();
      // Gemini refusing to look at the image is itself a rejection.
      if (data?.promptFeedback?.blockReason) {
        return { ok: false, retry: false, reason: 'This image is not allowed as a logo. Please choose a different image.' };
      }
      const cand = data?.candidates?.[0];
      if (cand?.finishReason === 'SAFETY') {
        return { ok: false, retry: false, reason: 'This image is not allowed as a logo. Please choose a different image.' };
      }
      const text = cand?.content?.parts?.[0]?.text;
      let parsed: { flagged?: unknown; reason?: unknown } | null = null;
      try { parsed = JSON.parse(String(text ?? '').replace(/^```json\s*|```$/g, '').trim()); } catch { parsed = null; }
      if (!parsed || typeof parsed.flagged !== 'boolean') { continue; } // unreadable → try next model
      if (parsed.flagged) {
        const why = typeof parsed.reason === 'string' && parsed.reason.trim() ? ` (${parsed.reason.trim()})` : '';
        return { ok: false, retry: false, reason: `This image is not allowed as a logo${why}. Please choose a different image.` };
      }
      return { ok: true };
    } catch (e) {
      console.warn('[set-merchant-logo] Gemini error', model, (e as Error)?.message);
    }
  }
  return { ok: false, retry: true, reason: 'We could not check this image right now. Please try again in a minute.' };
}

async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function cloudinaryEnv() {
  const cloud = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const key = Deno.env.get('CLOUDINARY_API_KEY');
  const secret = Deno.env.get('CLOUDINARY_API_SECRET');
  if (!cloud || !key || !secret) throw new Error('Image storage is not configured.');
  return { cloud, key, secret };
}

async function uploadLogo(merchantId: string, dataUri: string): Promise<string> {
  const { cloud, key, secret } = cloudinaryEnv();
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    invalidate: 'true',
    overwrite: 'true',
    public_id: `dealpro-logos/merchant_${merchantId}`,
    timestamp: String(timestamp),
  };
  const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, v);
  form.append('api_key', key);
  form.append('signature', await sha1Hex(toSign + secret));
  form.append('file', dataUri);
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form });
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok || !out?.secure_url) throw new Error(`Upload failed (${resp.status}): ${out?.error?.message ?? 'unknown'}`);
  return String(out.secure_url);
}

async function destroyLogo(merchantId: string): Promise<void> {
  const { cloud, key, secret } = cloudinaryEnv();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `dealpro-logos/merchant_${merchantId}`;
  const signature = await sha1Hex(`invalidate=true&public_id=${publicId}&timestamp=${timestamp}${secret}`);
  const form = new FormData();
  form.append('public_id', publicId);
  form.append('invalidate', 'true');
  form.append('timestamp', String(timestamp));
  form.append('api_key', key);
  form.append('signature', signature);
  await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, { method: 'POST', body: form }).catch(() => {});
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Owner only: must have their own merchant profile and not be active staff of another merchant.
    const { data: profile } = await admin
      .from('merchant_profiles').select('id, role').eq('id', user.id).maybeSingle();
    if (!profile || (profile.role ?? 'merchant') !== 'merchant') {
      return json({ error: 'Only the store owner can change the business logo.' }, 403);
    }
    const { data: staffRows } = await admin
      .from('merchant_staff').select('merchant_id').eq('user_id', user.id).eq('status', 'active');
    if ((staffRows ?? []).some((r: { merchant_id: string }) => r.merchant_id && r.merchant_id !== user.id)) {
      return json({ error: 'Only the store owner can change the business logo.' }, 403);
    }

    const body = await req.json().catch(() => ({}));

    if (body.action === 'remove') {
      await destroyLogo(user.id);
      const { error } = await admin.from('merchant_profiles')
        .update({ logo_url: null, logo_updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) throw error;
      return json({ logo_url: null });
    }

    if (body.action !== 'set') return json({ error: "action must be 'set' or 'remove'" }, 400);

    // Accept a data URI or bare base64.
    let raw = String(body.image ?? '');
    let mime = 'image/jpeg';
    const m = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,(.*)$/s);
    if (m) { mime = m[1]; raw = m[2]; }
    raw = raw.replace(/\s/g, '');
    if (!raw || !/^[A-Za-z0-9+/=]+$/.test(raw)) return json({ error: 'Please choose an image file.' }, 400);
    if (raw.length > MAX_BASE64_CHARS) return json({ error: 'This image is too large. Please choose a smaller one.' }, 413);

    const verdict = await moderate(raw, mime);
    if (!verdict.ok) {
      console.log('[set-merchant-logo] rejected', user.id, verdict.reason);
      return json({ error: verdict.reason, rejected: !verdict.retry, retry: verdict.retry }, verdict.retry ? 503 : 422);
    }

    const url = await uploadLogo(user.id, `data:${mime};base64,${raw}`);
    const { error } = await admin.from('merchant_profiles')
      .update({ logo_url: url, logo_updated_at: new Date().toISOString() }).eq('id', user.id);
    if (error) throw error;
    console.log('[set-merchant-logo] saved', user.id);
    return json({ logo_url: url });
  } catch (err: any) {
    console.error('[set-merchant-logo] error:', err?.message);
    return json({ error: 'Could not save the logo. Please try again.' }, 500);
  }
});
