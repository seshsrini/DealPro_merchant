// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Anonymous-callable invite-code validator. Tries 3 sources in order:
//
//   1. contractor_codes (new — contractors recruiting merchants)
//   2. merchant_profiles.merchant_referral_code (merchant-to-merchant referrals)
//   3. merchant_staff_invites.invite_code (staff joining an existing merchant's team)
//
// Returns { valid, code_type, label? } where code_type is "contractor" |
// "merchant_referral" | "staff_invite". The merchant-side UI uses code_type
// to decide what "Verified — …" message to show.
//
// Deploy with --no-verify-jwt (merchants don't have a session at this screen).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: { code?: string };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const raw = (body.code || '').trim().toUpperCase();
  if (!raw) return json({ valid: false, reason: 'empty' }, 200);
  if (raw.length < 4) return json({ valid: false, reason: 'too_short' }, 200);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── 1. Contractor codes ──────────────────────────────────────────────
  {
    const { data, error } = await supabase
      .from('contractor_codes')
      .select('id, code, first_name, servicing_city, active_status')
      .eq('code', raw)
      .maybeSingle();
    if (error) console.error('[validate-invite-code] contractor lookup:', error);
    if (data) {
      if (!data.active_status) return json({ valid: false, reason: 'inactive' }, 200);
      return json({
        valid: true,
        code_type: 'contractor',
        code: data.code,
        label: data.first_name
          ? `recruited by ${data.first_name}${data.servicing_city ? ' (' + data.servicing_city + ')' : ''}`
          : 'contractor code',
      });
    }
  }

  // ── 2. Merchant referral codes (merchant_profiles.merchant_referral_code) ──
  {
    const { data, error } = await supabase
      .from('merchant_profiles')
      .select('id, business_name, merchant_referral_code')
      .eq('merchant_referral_code', raw)
      .maybeSingle();
    if (error) console.error('[validate-invite-code] referral lookup:', error);
    if (data) {
      return json({
        valid: true,
        code_type: 'merchant_referral',
        code: data.merchant_referral_code,
        label: data.business_name
          ? `referred by ${data.business_name}`
          : 'merchant referral',
      });
    }
  }

  // ── 3. Staff invite codes (merchant_staff_invites.invite_code) ────────
  {
    const { data, error } = await supabase
      .from('merchant_staff_invites')
      .select('id, invite_code, merchant_id, status')
      .eq('invite_code', raw)
      .maybeSingle();
    if (error) console.error('[validate-invite-code] staff lookup:', error);
    if (data) {
      if (data.status !== 'pending' && data.status !== 'invited') {
        return json({ valid: false, reason: 'staff_invite_consumed' }, 200);
      }
      return json({
        valid: true,
        code_type: 'staff_invite',
        code: data.invite_code,
        label: 'staff invite from your store owner',
      });
    }
  }

  return json({ valid: false, reason: 'not_found' }, 200);
});
