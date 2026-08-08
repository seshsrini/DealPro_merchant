// ────────────────────────────────────────────────────────────────────────
// cloudinary-destroy — destroy Cloudinary assets by URL.
//
// Used by the drafts cleanup flow to remove orphaned uploads when:
//   • A merchant taps "Start Over" on the deal/DOTD wizard.
//   • A merchant uploads a NEW cover image, replacing an old draft cover.
//   • The nightly cleanup function evicts a stale draft.
//
// Body shape: { urls: string[] }
// Auth: requires merchant JWT. Only URLs containing `/dealpro-drafts/` will
// be destroyed — extra safety so a misuse can't wipe production assets.
//
// REQUIRED ENV VARS (set in Supabase project secrets):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
// ────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Extract Cloudinary public_id from a secure_url. Examples:
//   https://res.cloudinary.com/abc/image/upload/v1738/dealpro-drafts/foo.jpg → dealpro-drafts/foo
//   https://res.cloudinary.com/abc/image/upload/dealpro-drafts/bar.png       → dealpro-drafts/bar
function publicIdFromUrl(url: string): string | null {
  try {
    const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    return m ? m[1] : null;
  } catch { return null; }
}

// SHA-1 over a string, returning hex (Cloudinary destroy signature spec).
async function sha1Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-1', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!;

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

    // Robust staff lockout: block a suspended/removed staff member (false only when
    // the user has staff rows but none active). Fail-open on null.
    const { data: __actorOk } = await authClient.rpc('merchant_is_active_actor', { p_user_id: user.id });
    if (__actorOk === false) {
      return new Response(JSON.stringify({ error: 'ACCESS_DISABLED', message: 'Your access has been disabled by the store owner.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Body ──
    const body = await req.json();
    const urls: string[] = Array.isArray(body?.urls) ? body.urls.filter((u: unknown) => typeof u === 'string') : [];
    if (urls.length === 0) {
      return new Response(JSON.stringify({ destroyed: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety: only destroy assets in the drafts folder. Anything else is rejected.
    const draftsOnly = urls.filter(u => /\/dealpro-drafts\//.test(u));
    if (draftsOnly.length === 0) {
      return new Response(JSON.stringify({ destroyed: 0, reason: 'no draft urls in input' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')!;
    const apiKey    = Deno.env.get('CLOUDINARY_API_KEY')!;
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')!;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary credentials not configured on this function.');
    }

    let destroyed = 0;
    const failures: { url: string; reason: string }[] = [];

    // Destroy in parallel — Cloudinary tolerates 10s of concurrent destroy calls.
    await Promise.all(draftsOnly.map(async (url) => {
      const publicId = publicIdFromUrl(url);
      if (!publicId) {
        failures.push({ url, reason: 'could not extract public_id' });
        return;
      }
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await sha1Hex(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`);

      const form = new FormData();
      form.append('public_id', publicId);
      form.append('api_key', apiKey);
      form.append('timestamp', String(timestamp));
      form.append('signature', signature);

      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
          { method: 'POST', body: form, signal: AbortSignal.timeout(15000) }
        );
        const json = await res.json().catch(() => ({}));
        if (json?.result === 'ok' || json?.result === 'not found') {
          destroyed++;
        } else {
          failures.push({ url, reason: JSON.stringify(json).slice(0, 200) });
        }
      } catch (err: any) {
        failures.push({ url, reason: err?.message || 'network error' });
      }
    }));

    if (failures.length > 0) console.warn('[cloudinary-destroy] Some destroys failed:', failures);

    return new Response(JSON.stringify({ destroyed, failures }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const isAuth = error?.message?.includes('Unauthorized');
    if (isAuth) {
      console.warn('[cloudinary-destroy] Auth rejected:', error.message);
    } else {
      console.error('[cloudinary-destroy] Error:', error.message);
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: isAuth ? 401 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
