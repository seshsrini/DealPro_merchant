// ────────────────────────────────────────────────────────────────────────
// manage-signup-draft — server-side persistence for the merchant onboarding
// wizard. Keyed by the authenticated user's ID (JWT-bound), so each merchant
// can only touch their own row.
//
// Body shape: { action: 'save' | 'load' | 'delete', payload?, current_step? }
// Auth: requires merchant JWT (the merchant has already completed phone OTP
// by the time onboarding runs).
// ────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized: No access token provided.');
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      const reason = /jwt expired|expired/i.test(authError?.message || '') ? 'expired' : 'invalid';
      throw new Error(`Unauthorized: token ${reason}`);
    }

    // ── Body ──
    const body   = await req.json();
    const action = String(body?.action || '');

    if (!['save', 'load', 'delete'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action. Must be save, load, or delete.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    if (action === 'load') {
      const { data, error } = await admin
        .from('signup_drafts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ draft: data || null }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      const { error } = await admin
        .from('signup_drafts')
        .delete()
        .eq('user_id', user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ deleted: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── action === 'save' ──
    const payload     = body?.payload ?? {};
    const currentStep = Number.isInteger(body?.current_step) ? body.current_step : 0;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return new Response(JSON.stringify({ error: 'payload must be a JSON object.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await admin
      .from('signup_drafts')
      .upsert(
        { user_id: user.id, current_step: currentStep, payload },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ draft: data }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const isAuth = error?.message?.includes('Unauthorized');
    if (isAuth) {
      console.warn('[manage-signup-draft] Auth rejected:', error.message);
    } else {
      console.error('[manage-signup-draft] Error:', error.message);
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: isAuth ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
