// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined; };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Per-step signup save. The onboarding wizard calls this after each step so the
// merchant's answers land in merchant_profiles as they go (and an abandoned
// signup is visible there), instead of only at the final submit.
//
// Deliberately narrow — only what is safe to persist mid-signup:
//   fullName (step 1), storeName = legal name of business (step 2),
//   businessType + its document number (step 6), onboardingStep (every step).
//
// NOT accepted here (final submit only, via complete-merchant-profile):
//   terms/privacy acceptance, stores, onboarding_complete. Saving terms+privacy
//   early would make an unfinished merchant look "profile complete" to the app
//   gates and skip store creation; saving stores early would put unfinished
//   stores in front of consumers. Older clients that still send those fields
//   have them ignored.
//
// The client treats every error as non-fatal, so a failed save never blocks
// the wizard (signup_drafts still holds the full in-progress state).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });

const BUSINESS_TYPES = new Set(['gstin', 'udyam', 'fssai', 'trade_license', 'none']);
const UDYAM_RE = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
const FSSAI_RE = /^[0-9]{14}$/;
const TRADE_RE = /^[A-Z]{2}[A-Z0-9/\-]{3,20}$/;
const tidy = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // Suspended/removed staff can't write (fail-open on null, as elsewhere).
    const { data: actorOk } = await userClient.rpc('merchant_is_active_actor', { p_user_id: user.id });
    if (actorOk === false) {
      return json({ error: 'ACCESS_DISABLED', message: 'Your access has been disabled by the store owner.' }, 403);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));

    // Only the caller's own, unfinished profile is patched here.
    const { data: profile } = await admin
      .from('merchant_profiles')
      .select('id, onboarding_complete')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile) return json({ success: true, skipped: 'no merchant profile yet' });
    if (profile.onboarding_complete === true) return json({ success: true, skipped: 'onboarding already complete' });

    const patch: Record<string, unknown> = {};
    const errors: string[] = [];

    if (body.fullName !== undefined) {
      const v = tidy(body.fullName);
      if (v.length < 2 || v.length > 100) errors.push('fullName must be 2–100 characters');
      else patch.full_name = v;
    }
    if (body.storeName !== undefined) {
      const v = tidy(body.storeName);
      if (v.length < 2 || v.length > 150) errors.push('storeName must be 2–150 characters');
      else {
        // Step 2 is the legal name of the business; store_name mirrors it until
        // the final submit (same as complete-merchant-profile).
        patch.store_name = v;
        patch.legal_name = v;
      }
    }

    if (body.businessType !== undefined) {
      const bt = String(body.businessType);
      if (!BUSINESS_TYPES.has(bt)) {
        errors.push('invalid businessType');
      } else {
        patch.business_type = bt;
        // Exactly one document column is kept; the others are cleared.
        patch.gstin = null;
        patch.pan = null;
        patch.udyam_no = null;
        patch.fssai_no = null;
        patch.trade_license_no = null;
        if (bt === 'gstin') {
          // Arrives encrypted from the client (same as the final submit).
          if (typeof body.gstin === 'string' && body.gstin) patch.gstin = body.gstin;
          if (typeof body.pan === 'string' && body.pan) patch.pan = body.pan;
        } else if (bt === 'udyam') {
          const v = tidy(body.udyamNo).toUpperCase();
          if (v && !UDYAM_RE.test(v)) errors.push('invalid Udyam number');
          else patch.udyam_no = v || null;
        } else if (bt === 'fssai') {
          const v = tidy(body.fssaiNo);
          if (v && !FSSAI_RE.test(v)) errors.push('invalid FSSAI number');
          else patch.fssai_no = v || null;
        } else if (bt === 'trade_license') {
          const v = tidy(body.tradeLicenseNo).toUpperCase();
          if (v && !TRADE_RE.test(v)) errors.push('invalid trade license number');
          else patch.trade_license_no = v || null;
        }
      }
    }

    if (body.onboardingStep !== undefined) {
      const s = Number(body.onboardingStep);
      if (Number.isInteger(s) && s >= 0 && s <= 20) {
        patch.onboarding_step = s;
        patch.onboarding_step_at = new Date().toISOString();
      }
    }

    if (errors.length) return json({ error: errors.join('; ') }, 400);
    if (Object.keys(patch).length === 0) return json({ success: true, fields: [] });

    let { error } = await admin.from('merchant_profiles').update(patch).eq('id', user.id);
    // Schema lag: tracking columns not migrated yet → save the answers anyway.
    if (error && /onboarding_step/i.test(error.message || '')) {
      delete patch.onboarding_step;
      delete patch.onboarding_step_at;
      ({ error } = await admin.from('merchant_profiles').update(patch).eq('id', user.id));
    }
    if (error) {
      const dup = (error as { code?: string }).code === '23505';
      console.error('[PatchMerchantProfile] update failed:', error.message);
      return json(
        { error: dup ? 'This business document is already registered with another merchant.' : 'Could not save progress' },
        dup ? 409 : 500
      );
    }

    console.log('[PatchMerchantProfile] saved', user.id, Object.keys(patch));
    return json({ success: true, fields: Object.keys(patch) });
  } catch (err: any) {
    console.error('[PatchMerchantProfile] Error:', err?.message);
    return json({ error: 'Internal server error' }, 500);
  }
});
