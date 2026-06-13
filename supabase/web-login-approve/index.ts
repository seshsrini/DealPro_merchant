// web-login-approve — AUTHENTICATED, called by the merchant's mobile app
// (must send Authorization: Bearer <merchant access_token>).
//
//   action: 'list'   → return this merchant's PENDING web-login requests so the
//                      app can prompt "Approve web login? #1234".
//   action: 'decide' → { request_id, approve } — approve mints a single-use
//                      magic-link token_hash on the row (the web client then
//                      claims it via `web-login-request` action 'claim'); deny
//                      marks it denied.
//
// Ownership is enforced by the caller's JWT: a merchant can only see/approve
// requests whose merchant_id equals their own auth user id.

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Authenticate the caller from their bearer token.
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
    const callerId = userData.user.id;

    const body = await req.json();
    const action = body.action;

    // ─────────────────────────────────────────────────────────────────────────
    // LIST — pending, non-expired requests belonging to this merchant.
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const { data: rows } = await admin
        .from('web_login_requests')
        .select('id, request_code, requester_label, created_at, expires_at')
        .eq('merchant_id', callerId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      return json({
        requests: (rows || []).map((r) => ({
          request_id: r.id,
          request_code: r.request_code,
          requester_label: r.requester_label,
          created_at: r.created_at,
          expires_at: r.expires_at,
        })),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DECIDE — approve (mint token_hash) or deny a specific request.
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'decide') {
      const { request_id, approve } = body;
      if (!request_id) return json({ error: 'Missing request_id' }, 400);

      const { data: row } = await admin
        .from('web_login_requests')
        .select('*')
        .eq('id', request_id)
        .maybeSingle();

      if (!row) return json({ error: 'Request not found' }, 404);
      if (row.merchant_id !== callerId) return json({ error: 'forbidden' }, 403); // not your request
      if (row.status !== 'pending') return json({ error: 'already_handled', status: row.status }, 409);
      if (new Date(row.expires_at).getTime() < Date.now()) {
        await admin.from('web_login_requests').update({ status: 'expired' }).eq('id', row.id);
        return json({ error: 'expired' }, 410);
      }

      if (!approve) {
        await admin.from('web_login_requests').update({ status: 'denied' }).eq('id', row.id);
        return json({ ok: true, status: 'denied' });
      }

      // Approve → mint a single-use magic-link token for this merchant's auth user,
      // exactly like login-merchant. The web client claims + verifies it.
      const { data: authUser } = await admin.auth.admin.getUserById(callerId);
      const email = authUser?.user?.email;
      if (!email) return json({ error: 'Account email not found' }, 500);

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
      const tokenHash = linkData?.properties?.hashed_token;
      if (linkErr || !tokenHash) {
        console.error('[web-login-approve] generateLink failed:', linkErr?.message);
        return json({ error: 'Could not approve login' }, 500);
      }

      await admin
        .from('web_login_requests')
        .update({ status: 'approved', token_hash: tokenHash, approved_by: callerId })
        .eq('id', row.id);

      return json({ ok: true, status: 'approved' });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err: any) {
    console.error('[web-login-approve] error:', err?.message);
    return json({ error: 'Internal server error' }, 500);
  }
});
