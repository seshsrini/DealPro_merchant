// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined; };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// One-time pass for the web subscription page.
//
//   POST (signed-in merchant)  →  { pass, expires_in: 600 }
//
// The app opens vedicjaalam.com/merchant/subscribe?pass=<pass>; the website swaps
// it (once, within 10 minutes) for a short browser session, so plan changes and
// cancels there are tied to the signed-in merchant instead of a merchant_id in
// the link. Only a SHA-256 of the pass is stored (billing_sessions,
// create_billing_sessions.sql).
//
// Who may get one: the owner, or staff whose role has 'subscription.manage'
// (merchant_permissions) — the same rule the app uses to show the button.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });

const PASS_MINUTES = 10;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomPass(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Caller's merchant + role — same resolution as manage-staff.
    const { data: staffRows } = await admin
      .from('merchant_staff')
      .select('merchant_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('role', { ascending: true });
    const staffRow = (staffRows || []).find((r: { merchant_id: string }) => r.merchant_id !== user.id) || (staffRows || [])[0] || null;
    const merchantId: string = staffRow?.merchant_id || user.id;
    const role: string = staffRow?.role || 'owner';

    if (role === 'owner') {
      const { data: profile } = await admin.from('merchant_profiles').select('id').eq('id', merchantId).maybeSingle();
      if (!profile) return json({ error: 'Merchant profile not found.' }, 404);
    } else {
      const { data: perm } = await admin
        .from('merchant_permissions')
        .select('allowed')
        .eq('role', role)
        .eq('permission', 'subscription.manage')
        .eq('allowed', true)
        .maybeSingle();
      if (!perm) return json({ error: 'Only the store owner can manage the subscription.' }, 403);
    }

    const pass = randomPass();
    const { error } = await admin.from('billing_sessions').insert({
      merchant_id: merchantId,
      issued_to: user.id,
      pass_hash: await sha256Hex(pass),
      pass_expires_at: new Date(Date.now() + PASS_MINUTES * 60_000).toISOString(),
    });
    if (error) throw error;
    return json({ pass, expires_in: PASS_MINUTES * 60 });
  } catch (err: any) {
    console.error('[issue-billing-pass] error:', err?.message);
    return json({ error: 'Could not open the subscription page. Please try again.' }, 500);
  }
});
