// ────────────────────────────────────────────────────────────────────────
// manage-draft — server-side persistence for in-flight campaign wizards.
//
// Body shape: { action: 'save' | 'load' | 'delete', kind: 'regular'|'dotd'|...,
//               payload?, current_step?, cover_image_url?, additional_image_urls?,
//               free_gift_image_urls? }
//
// Auth: requires a valid merchant JWT. The merchant_id is taken from the JWT,
// never from the request body — prevents merchants from touching each other's
// drafts even if the caller tries.
// ────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VALID_KINDS = new Set(['regular', 'dotd', 'buy_get_free_regular', 'buy_get_free_dotd']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    const body = await req.json();
    const action = String(body?.action || '');
    const kind   = String(body?.kind || '');

    if (!['save', 'load', 'delete'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Invalid action. Must be save, load, or delete.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!VALID_KINDS.has(kind)) {
      return new Response(JSON.stringify({ error: `Invalid kind. Must be one of: ${[...VALID_KINDS].join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── DB client (service role bypasses RLS for admin operations) ──
    const admin = createClient(supabaseUrl, serviceKey);

    if (action === 'load') {
      const { data, error } = await admin
        .from('campaign_drafts')
        .select('*')
        .eq('merchant_id', user.id)
        .eq('kind', kind)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ draft: data || null }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      // Fetch first so we can return the image URLs the caller may want to
      // destroy on Cloudinary (orphaned drafts would otherwise pile up).
      const { data: existing } = await admin
        .from('campaign_drafts')
        .select('cover_image_url, additional_image_urls, free_gift_image_urls')
        .eq('merchant_id', user.id)
        .eq('kind', kind)
        .maybeSingle();

      const { error } = await admin
        .from('campaign_drafts')
        .delete()
        .eq('merchant_id', user.id)
        .eq('kind', kind);
      if (error) throw error;

      return new Response(JSON.stringify({
        deleted: true,
        orphaned_image_urls: existing
          ? [
              existing.cover_image_url,
              ...(existing.additional_image_urls || []),
              ...(existing.free_gift_image_urls || []),
            ].filter(Boolean)
          : [],
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── action === 'save' (upsert) ──
    const payload      = body?.payload ?? {};
    const currentStep  = Number.isInteger(body?.current_step) ? body.current_step : 0;
    const coverUrl     = body?.cover_image_url ?? null;
    const additionalUrls   = Array.isArray(body?.additional_image_urls)   ? body.additional_image_urls.filter((u: unknown) => typeof u === 'string')   : [];
    const freeGiftImageUrls = Array.isArray(body?.free_gift_image_urls)    ? body.free_gift_image_urls.filter((u: unknown) => typeof u === 'string')    : [];

    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return new Response(JSON.stringify({ error: 'payload must be a JSON object.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await admin
      .from('campaign_drafts')
      .upsert(
        {
          merchant_id: user.id,
          kind,
          current_step: currentStep,
          payload,
          cover_image_url: coverUrl,
          additional_image_urls: additionalUrls,
          free_gift_image_urls: freeGiftImageUrls,
          // updated_at handled by trigger
        },
        { onConflict: 'merchant_id,kind' }
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
      console.warn('[manage-draft] Auth rejected:', error.message);
    } else {
      console.error('[manage-draft] Error:', error.message);
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: isAuth ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
