// verify-business-document — verify a merchant's GST / Udyam / FSSAI / Trade-License
// number against a KYC provider, save the raw response + a verified flag on the
// merchant's profile, and return the result.
//
// Body: { doc_type: 'gstin' | 'udyam' | 'fssai' | 'trade_license', number: string }
// Auth: merchant's Supabase JWT (a merchant can only verify their own profile).
//
// Provider is chosen by KYC_PROVIDER = 'surepass' | 'deepvue' (default surepass).
//   KYC_MOCK_MODE=true            → simulate success (DEV/testing), no provider call.
//   Surepass:  SUREPASS_TOKEN (Bearer).
//   Deepvue:   DEEPVUE_CLIENT_ID + DEEPVUE_CLIENT_SECRET.

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

type DocType = 'gstin' | 'udyam' | 'fssai' | 'trade_license';
const PREFIX: Record<DocType, string> = { gstin: 'gstin', udyam: 'udyam', fssai: 'fssai', trade_license: 'trade_license' };

interface VerifyOut { verified: boolean; raw: Record<string, unknown> }

// ── Provider adapters ────────────────────────────────────────────────────────

async function verifySurepass(docType: DocType, number: string): Promise<VerifyOut> {
  // Surepass has no Trade/Shop-Establishment endpoint (no central registry).
  const paths: Record<DocType, string | null> = {
    gstin: '/corporate/gstin',
    udyam: '/corporate/udyog-aadhaar',
    fssai: '/corporate/fssai',
    trade_license: null,
  };
  const path = paths[docType];
  if (!path) return { verified: false, raw: { success: false, error: 'not_supported', message: 'No central registry for this document.' } };
  const token = Deno.env.get('SUREPASS_TOKEN');
  if (!token) throw new Error('SUREPASS_TOKEN not configured');
  const res = await fetch(`https://kyc-api.surepass.io/api/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_number: number }),
  });
  const raw = await res.json().catch(() => ({ success: false, error: `provider_${res.status}` }));
  return { verified: res.ok && raw?.success === true, raw };
}

let deepvueTokenCache: { token: string; exp: number } | null = null;
async function deepvueToken(): Promise<string> {
  if (deepvueTokenCache && deepvueTokenCache.exp > Date.now()) return deepvueTokenCache.token;
  const id = Deno.env.get('DEEPVUE_CLIENT_ID');
  const secret = Deno.env.get('DEEPVUE_CLIENT_SECRET');
  if (!id || !secret) throw new Error('DEEPVUE_CLIENT_ID / DEEPVUE_CLIENT_SECRET not configured');
  const res = await fetch('https://production.deepvue.tech/v1/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}`,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j?.access_token) throw new Error(`Deepvue auth ${res.status}`);
  // Tokens are valid 24h; cache for 23h.
  deepvueTokenCache = { token: j.access_token, exp: Date.now() + 23 * 3600 * 1000 };
  return j.access_token;
}

async function verifyDeepvue(docType: DocType, number: string): Promise<VerifyOut> {
  // NOTE: confirm exact paths/param names against https://docs.deepvue.ai/ once you
  // have a Deepvue account — these are the documented shapes but easy to adjust.
  const conf: Record<DocType, { path: string; param: string }> = {
    gstin: { path: '/v1/verification/gstin', param: 'gstin_number' },
    udyam: { path: '/v1/verification/udyam', param: 'udyam_number' },
    fssai: { path: '/v1/verification/fssai', param: 'fssai_number' },
    trade_license: { path: '/v1/verification/shop-establishment', param: 'license_number' },
  };
  const c = conf[docType];
  const token = await deepvueToken();
  const res = await fetch(`https://production.deepvue.tech${c.path}?${c.param}=${encodeURIComponent(number)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const raw = await res.json().catch(() => ({}));
  // Deepvue returns code 200 + a data object on a successful lookup.
  const verified = res.ok && (raw?.code === 200 || raw?.success === true || !!raw?.data);
  return { verified, raw };
}

function mockVerify(docType: DocType, number: string): VerifyOut {
  return {
    verified: true,
    raw: { success: true, mock: true, data: { id_number: number, legal_name: 'MOCK VERIFIED ENTERPRISE', status: 'Active', doc_type: docType } },
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { doc_type, number } = await req.json();
    if (!PREFIX[doc_type as DocType]) return json({ error: 'Invalid doc_type' }, 400);
    if (!number || typeof number !== 'string' || number.trim().length < 4) {
      return json({ error: 'A valid document number is required' }, 400);
    }
    const docType = doc_type as DocType;
    const value = number.trim().toUpperCase();

    const mock = String(Deno.env.get('KYC_MOCK_MODE') || '').toLowerCase() === 'true';
    const provider = (Deno.env.get('KYC_PROVIDER') || 'surepass').toLowerCase();

    let out: VerifyOut;
    if (mock) out = mockVerify(docType, value);
    else if (provider === 'deepvue') out = await verifyDeepvue(docType, value);
    else out = await verifySurepass(docType, value);

    // Persist the raw response + verified flag on the merchant's own profile.
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const patch: Record<string, unknown> = {};
    patch[`${PREFIX[docType]}_verified`] = out.verified;
    patch[`${PREFIX[docType]}_verification`] = out.raw;
    const { error: upErr } = await admin.from('merchant_profiles').update(patch).eq('id', user.id);
    if (upErr) return json({ error: `Save failed: ${upErr.message}` }, 500);

    return json({ verified: out.verified, data: out.raw, mock, provider: mock ? 'mock' : provider });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
