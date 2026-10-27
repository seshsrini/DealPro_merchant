// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined; };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Business registration for an ALREADY-ONBOARDED merchant (patch-merchant-profile
// only works mid-signup). Every merchant must have one of GSTIN / Udyam / FSSAI /
// Trade Licence — there is no "none" — so merchants who signed up before that rule
// are sent to the "Business registration required" screen, which saves here.
//
//   POST { businessType: 'gstin', gstin: <encrypted>, pan: <encrypted> }
//   POST { businessType: 'udyam' | 'fssai' | 'trade_license', <udyamNo|fssaiNo|tradeLicenseNo> }
//   → { success: true, business_type, ...the saved document column }
//
// Owner only (same rule as get-profile): staff acting for the owner can't change it.
// GSTIN/PAN arrive encrypted from the client exactly as in the signup submit; the
// GST registry check and duplicate checks run in the client step beforehand, and the
// plain-text numbers are re-checked for duplicates here.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });

const UDYAM_RE = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
const FSSAI_RE = /^[0-9]{14}$/;
const TRADE_RE = /^[A-Z]{2}[A-Z0-9/\-]{3,20}$/;
const tidy = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, '') : '');

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

    const { data: profile } = await admin.from('merchant_profiles').select('id').eq('id', user.id).maybeSingle();
    if (!profile) return json({ error: 'Merchant profile not found.' }, 404);
    const { data: staffRows } = await admin
      .from('merchant_staff').select('merchant_id, role').eq('user_id', user.id).eq('status', 'active');
    if ((staffRows ?? []).some((r: { merchant_id: string; role: string }) => r.role !== 'owner' && r.merchant_id && r.merchant_id !== user.id)) {
      return json({ error: 'Only the store owner can add the business registration.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const bt = String(body.businessType ?? '');
    const patch: Record<string, unknown> = {
      business_type: bt, gstin: null, pan: null, udyam_no: null, fssai_no: null, trade_license_no: null,
    };
    let dupColumn: string | null = null;

    if (bt === 'gstin') {
      if (typeof body.gstin !== 'string' || !body.gstin || typeof body.pan !== 'string' || !body.pan) {
        return json({ error: 'GSTIN and PAN are required.' }, 400);
      }
      patch.gstin = body.gstin;
      patch.pan = body.pan;
    } else if (bt === 'udyam') {
      const v = tidy(body.udyamNo).toUpperCase();
      if (!UDYAM_RE.test(v)) return json({ error: 'Please enter a valid Udyam number (UDYAM-XX-00-0000000).' }, 400);
      patch.udyam_no = v; dupColumn = 'udyam_no';
    } else if (bt === 'fssai') {
      const v = tidy(body.fssaiNo);
      if (!FSSAI_RE.test(v)) return json({ error: 'Please enter a valid 14-digit FSSAI number.' }, 400);
      patch.fssai_no = v; dupColumn = 'fssai_no';
    } else if (bt === 'trade_license') {
      const v = tidy(body.tradeLicenseNo).toUpperCase();
      if (!TRADE_RE.test(v)) return json({ error: 'Please enter a valid trade licence number.' }, 400);
      patch.trade_license_no = v; dupColumn = 'trade_license_no';
    } else {
      return json({ error: 'Choose GSTIN, Udyam, FSSAI or Trade Licence.' }, 400);
    }

    if (dupColumn) {
      const { data: taken } = await admin
        .from('merchant_profiles').select('id').eq(dupColumn, patch[dupColumn] as string).neq('id', user.id).limit(1);
      if ((taken ?? []).length > 0) {
        return json({ error: 'This number is already registered with another merchant.' }, 409);
      }
    }

    const { error } = await admin.from('merchant_profiles').update(patch).eq('id', user.id);
    if (error) throw error;
    console.log('[set-business-document] saved', bt, 'for', user.id);
    return json({ success: true, ...patch });
  } catch (err: any) {
    console.error('[set-business-document] error:', err?.message);
    return json({ error: 'Could not save your business registration. Please try again.' }, 500);
  }
});
