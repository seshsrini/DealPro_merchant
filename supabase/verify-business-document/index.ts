// verify-business-document — verify a merchant's GST / Udyam / FSSAI / Trade-License
// number against a KYC provider, save the raw response + a verified flag on the
// merchant's profile, and return the result.
//
// Body: { doc_type: 'gstin' | 'udyam' | 'fssai' | 'trade_license', number: string }
// Auth: merchant's Supabase JWT (a merchant can only verify their own profile).
//
// Provider is chosen by KYC_PROVIDER = 'surepass' | 'deepvue' | 'sandbox' (default surepass),
// and can be overridden per doc type via KYC_PROVIDER_GSTIN / _UDYAM / _FSSAI / _TRADE_LICENSE
// (e.g. GST on Sandbox, Udyam on Deepvue).
//   KYC_MOCK_MODE=true            → simulate success (DEV/testing), no provider call.
//   Surepass:  SUREPASS_TOKEN (Bearer).
//   Deepvue:   DEEPVUE_CLIENT_ID + DEEPVUE_CLIENT_SECRET.
//   Sandbox:   SANDBOX_API_KEY + SANDBOX_API_SECRET (GST only; optional SANDBOX_API_BASE
//              for the test host https://test-api.sandbox.co.in).

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

// Sandbox (sandbox.co.in / Quicko) — two-step auth: api_key + api_secret →
// /authenticate returns a JWT access_token (valid 24h, NOT a bearer token).
// Its public compliance suite covers GST; Udyam/FSSAI/Trade-License aren't part
// of it, so those fall back to "not supported".
let sandboxTokenCache: { token: string; exp: number } | null = null;
function sandboxBase(): string {
  return (Deno.env.get('SANDBOX_API_BASE') || 'https://api.sandbox.co.in').replace(/\/$/, '');
}
async function sandboxToken(): Promise<string> {
  if (sandboxTokenCache && sandboxTokenCache.exp > Date.now()) return sandboxTokenCache.token;
  const key = Deno.env.get('SANDBOX_API_KEY');
  const secret = Deno.env.get('SANDBOX_API_SECRET');
  if (!key || !secret) throw new Error('SANDBOX_API_KEY / SANDBOX_API_SECRET not configured');
  const res = await fetch(`${sandboxBase()}/authenticate`, {
    method: 'POST',
    headers: { 'x-api-key': key, 'x-api-secret': secret, 'x-api-version': '1.0' },
  });
  const j = await res.json().catch(() => ({}));
  const token = j?.data?.access_token;
  if (!res.ok || !token) throw new Error(`Sandbox auth failed (${res.status})`);
  // Valid 24h — cache for 23h.
  sandboxTokenCache = { token, exp: Date.now() + 23 * 3600 * 1000 };
  return token;
}

async function verifySandbox(docType: DocType, number: string): Promise<VerifyOut> {
  if (docType !== 'gstin') {
    return { verified: false, raw: { success: false, error: 'not_supported', message: 'Sandbox supports GST verification only. Use mock or another provider for this document.' } };
  }
  const key = Deno.env.get('SANDBOX_API_KEY')!;
  const token = await sandboxToken();
  const res = await fetch(`${sandboxBase()}/gst/compliance/public/gstin/search`, {
    method: 'POST',
    headers: {
      // Sandbox tokens are NOT bearer — pass the raw token in `authorization`.
      'authorization': token,
      'x-api-key': key,
      'x-api-version': '1.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ gstin: number }),
  });
  const raw = await res.json().catch(() => ({ success: false, error: `provider_${res.status}` }));
  // A real GSTIN resolves to a taxpayer record (data.data.gstin) with status_cd '1'.
  const inner = (raw as any)?.data?.data;
  const statusCd = (raw as any)?.data?.status_cd;
  const verified = res.ok && (raw as any)?.code === 200 && statusCd === '1' && !!inner?.gstin;
  return { verified, raw };
}

function mockVerify(docType: DocType, number: string): VerifyOut {
  return {
    verified: true,
    raw: { success: true, mock: true, data: { id_number: number, legal_name: 'MOCK VERIFIED ENTERPRISE', status: 'Active', doc_type: docType } },
  };
}

// ── Legal-name cross-check ───────────────────────────────────────────────────
// Normalise a business name for comparison: uppercase, expand '&', drop common
// legal/entity suffixes and noise, collapse to alphanumerics + single spaces.
function normalizeName(s: string): string {
  return (s || '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/\b(PRIVATE|PVT|LIMITED|LTD|LLP|LLC|INC|CORPORATION|CORP|COMPANY|ENTERPRISES?|ENTERPRISE|TRADERS?|INDIA|AND|THE|M\/S|MS)\b/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Fuzzy match — exact normalised match, containment, or ≥70% token overlap.
function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a), nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const ta = na.split(' ').filter((t) => t.length > 1);
  const tb = nb.split(' ').filter((t) => t.length > 1);
  if (!ta.length || !tb.length) return false;
  const [shortToks, longSet] = ta.length <= tb.length ? [ta, new Set(tb)] : [tb, new Set(ta)];
  const overlap = shortToks.filter((t) => longSet.has(t)).length;
  return overlap / shortToks.length >= 0.7;
}

// Pull the registry's name candidates out of a provider's raw GSTIN response.
// Returns BOTH the legal name and the trade name — for proprietorships the legal
// name is the owner's personal name while the trade name is the shop/brand, so a
// merchant may legitimately enter either. We accept a match against any of them.
function extractProviderNames(provider: string, raw: any): string[] {
  const names: Array<string | null | undefined> = [];
  try {
    if (provider === 'sandbox') {
      const d = raw?.data?.data;
      names.push(d?.lgnm, d?.tradeNam);
    } else if (provider === 'surepass') {
      const d = raw?.data;
      names.push(d?.legal_name, d?.trade_name, d?.business_name, d?.company_name);
    } else if (provider === 'deepvue') {
      const d = raw?.data;
      names.push(d?.legal_name, d?.trade_name, d?.business_name);
    } else {
      const d = raw?.data;
      names.push(d?.legal_name, d?.trade_name, d?.lgnm, d?.data?.lgnm, d?.data?.tradeNam);
    }
  } catch { /* ignore */ }
  return [...new Set(names.filter((n): n is string => typeof n === 'string' && n.trim().length > 0))];
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

    const { doc_type, number, legal_name } = await req.json();
    if (!PREFIX[doc_type as DocType]) return json({ error: 'Invalid doc_type' }, 400);
    if (!number || typeof number !== 'string' || number.trim().length < 4) {
      return json({ error: 'A valid document number is required' }, 400);
    }
    const docType = doc_type as DocType;
    const value = number.trim().toUpperCase();
    const expectedLegalName = typeof legal_name === 'string' ? legal_name.trim() : '';

    const mock = String(Deno.env.get('KYC_MOCK_MODE') || '').toLowerCase() === 'true';
    // Provider can be set PER document type so different docs can use different
    // providers — e.g. GST on Sandbox, Udyam on Deepvue/Zoop. Per-doc env var
    // (KYC_PROVIDER_GSTIN / _UDYAM / _FSSAI / _TRADE_LICENSE) wins, else the
    // global KYC_PROVIDER, else surepass.
    const provider = (
      Deno.env.get(`KYC_PROVIDER_${docType.toUpperCase()}`) ||
      Deno.env.get('KYC_PROVIDER') ||
      'surepass'
    ).toLowerCase();

    let out: VerifyOut;
    if (mock) out = mockVerify(docType, value);
    else if (provider === 'sandbox') out = await verifySandbox(docType, value);
    else if (provider === 'deepvue') out = await verifyDeepvue(docType, value);
    else out = await verifySurepass(docType, value);

    // Cross-check the GST registry's legal name against the name the merchant
    // entered. A GSTIN that resolves but to a DIFFERENT business is NOT verified.
    // (Skipped in mock mode, and when no legal name was supplied.)
    let nameMatch: boolean | null = null;
    let providerLegalName: string | null = null;
    let registryNames: string[] = [];
    if (!mock && docType === 'gstin' && expectedLegalName && out.verified) {
      const candidates = extractProviderNames(provider, out.raw);
      registryNames = candidates;
      providerLegalName = candidates[0] || null; // legal name (for display)
      if (candidates.length > 0) {
        // Match against the legal name OR the trade name.
        nameMatch = candidates.some((c) => namesMatch(expectedLegalName, c));
        out.verified = out.verified && nameMatch;
      }
      out.raw = {
        ...out.raw,
        _legal_name_check: { expected: expectedLegalName, registry: candidates, matched: nameMatch },
      };
    }

    // Persist the raw response + verified flag on the merchant's own profile.
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Append this external API call to the append-only audit log
    // (api_response_payload). Best-effort read of the existing log; tolerate a
    // missing column / null. Capped to the most recent 100 entries.
    const auditEntry = {
      source: 'verify-business-document',
      doc_type: docType,
      number: value,
      provider: mock ? 'mock' : provider,
      verified: out.verified,
      legal_name_match: nameMatch,
      registry_legal_name: providerLegalName,
      at: new Date().toISOString(),
      response: out.raw,
    };
    let auditLog: unknown[] = [];
    try {
      const { data: existing } = await admin
        .from('merchant_profiles')
        .select('api_response_payload')
        .eq('id', user.id)
        .single();
      const cur = (existing as any)?.api_response_payload;
      if (Array.isArray(cur)) auditLog = cur;
      else if (cur && Array.isArray(cur.entries)) auditLog = cur.entries;
    } catch { /* column may not exist yet — start fresh */ }
    auditLog.push(auditEntry);
    if (auditLog.length > 100) auditLog = auditLog.slice(-100);

    const patch: Record<string, unknown> = {};
    patch[`${PREFIX[docType]}_verified`] = out.verified;
    patch[`${PREFIX[docType]}_verification`] = out.raw;
    patch['api_response_payload'] = auditLog;

    let { error: upErr } = await admin.from('merchant_profiles').update(patch).eq('id', user.id);
    // Resilience: if the audit column isn't present yet (migration not applied),
    // save the verification without it rather than failing the whole call.
    if (upErr && /api_response_payload/i.test(upErr.message || '')) {
      console.warn('[verify-business-document] api_response_payload column missing — saving without it.');
      delete patch['api_response_payload'];
      ({ error: upErr } = await admin.from('merchant_profiles').update(patch).eq('id', user.id));
    }
    if (upErr) return json({ error: `Save failed: ${upErr.message}` }, 500);

    return json({
      verified: out.verified,
      data: out.raw,
      mock,
      provider: mock ? 'mock' : provider,
      legal_name_match: nameMatch,
      registry_legal_name: providerLegalName,
      registry_names: registryNames,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
