
// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Inlined content of validation.ts
export function isString(value: any): boolean {
  return typeof value === 'string';
}

export function isObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isDateString(value: string): boolean {
  return !isNaN(new Date(value).getTime());
}
// End of inlined validation.ts

// ─── Content Moderation ──────────────────────────────────────────────
// Multi-category moderation for merchant deal content.
// Categories: profanity, sexual, hate_speech, harassment
// Covers English + Hindi/Hinglish + regional Indian languages.

interface ModerationResult {
  flagged: boolean;
  categories: string[];
  flaggedField: string;
  flaggedTerm: string;
}

const MODERATION_LISTS: Record<string, string[]> = {
  profanity: [
    // English
    'fuck', 'fucking', 'fucker', 'fck', 'f u c k', 'shit', 'shitty', 'bullshit',
    'bitch', 'bitchy', 'damn', 'damned', 'crap', 'crappy', 'piss', 'pissed',
    'bastard', 'ass', 'asshole', 'arsehole', 'arse', 'dumbass', 'jackass',
    'wtf', 'stfu', 'lmfao',
    // Hindi / Hinglish
    'chutiya', 'chutiye', 'madarchod', 'mc', 'bhenchod', 'bc', 'bhosdike',
    'bhosdiwale', 'gaand', 'gandu', 'lund', 'lauda', 'laude', 'randi',
    'harami', 'haramkhor', 'kutiya', 'kutte', 'sala', 'saala', 'saale',
    'ullu', 'gadha', 'bewakoof', 'kamina', 'kamine', 'kameena', 'kameene',
    'tatti', 'hagne', 'jhant', 'jhatu', 'chut', 'bhadwa', 'bhadwe',
    // Kannada
    'sule', 'magne', 'mundaige', 'bolimaga',
    // Tamil
    'thevdiya', 'sunni', 'punda', 'oombu',
    // Telugu
    'dengey', 'pooku', 'modda', 'lanja', 'lanjakodaka',
  ],
  sexual: [
    // English
    'porn', 'porno', 'pornography', 'xxx', 'nude', 'nudes', 'naked', 'sex',
    'sexy', 'sexual', 'orgasm', 'erotic', 'erotica', 'dildo', 'vibrator',
    'masturbat', 'penis', 'vagina', 'boobs', 'tits', 'nipple', 'blowjob',
    'handjob', 'anal', 'cumshot', 'hentai', 'milf', 'stripper', 'escort',
    'prostitut', 'brothel', 'hookup', 'onlyfans',
    // Hindi
    'chod', 'chodna', 'chudai', 'muth', 'muthhal', 'nanga', 'nangi',
  ],
  hate_speech: [
    // English slurs
    'nigger', 'nigga', 'faggot', 'fag', 'dyke', 'tranny', 'retard', 'retarded',
    'spastic', 'cripple',
    // Communal / casteist (India-specific)
    'chamaar', 'chamar', 'bhangi', 'chuhra', 'mlechha', 'kaffir', 'kafir',
    // Hate phrases (checked as substrings)
    'kill all', 'death to', 'go back to', 'gas the', 'hang all',
  ],
  harassment: [
    // Threats and intimidation
    'i will kill', 'i\'ll kill', 'gonna kill', 'want to kill',
    'i will hurt', 'gonna hurt', 'beat you up', 'i will beat you',
    'threaten', 'threat', 'stalk', 'stalking',
    'rape', 'rapist', 'molest',
    'bomb', 'bombing', 'attack', 'shoot', 'shooting',
    // Abusive targeting
    'kys', 'kill yourself', 'go die',
  ],
};

function normalizeForModeration(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[0]/g, 'o')
    .replace(/[5\$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function moderateText(text: string, fieldName: string): ModerationResult | null {
  if (!text || typeof text !== 'string' || text.trim().length === 0) return null;
  const normalized = normalizeForModeration(text);
  for (const [category, terms] of Object.entries(MODERATION_LISTS)) {
    for (const term of terms) {
      const termNorm = normalizeForModeration(term);
      if (termNorm.includes(' ')) {
        if (normalized.includes(termNorm)) {
          return { flagged: true, categories: [category], flaggedField: fieldName, flaggedTerm: term };
        }
      } else {
        const regex = new RegExp(`\\b${termNorm}\\b`);
        if (regex.test(normalized)) {
          return { flagged: true, categories: [category], flaggedField: fieldName, flaggedTerm: term };
        }
      }
    }
  }
  return null;
}

function moderateCampaignContent(fields: Record<string, string | undefined>): ModerationResult | null {
  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value) continue;
    const result = moderateText(value, fieldName);
    if (result) return result;
  }
  return null;
}

const MODERATION_CATEGORY_MESSAGES: Record<string, string> = {
  profanity: 'Your deal contains inappropriate language. Please remove profanity and resubmit.',
  sexual: 'Your deal contains sexual content which is not allowed. Please revise and resubmit.',
  hate_speech: 'Your deal contains hateful or discriminatory language. Please revise and resubmit.',
  harassment: 'Your deal contains threatening or harassing language. Please revise and resubmit.',
};
// ─── End Content Moderation ──────────────────────────────────────────

// Inlined content of authenticateRequest
export async function authenticateRequest(req: Request, corsHeaders: HeadersInit): Promise<Response | any> { // Using 'any' for User type in EF context for simplicity
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No access token provided.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);

  if (error || !user) {
    console.error('[authenticateRequest] JWT authentication failed:', error?.message);
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  return user;
}
// End of inlined authenticateRequest

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Simplified methods
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    const user = await authenticateRequest(req, corsHeaders); // Pass corsHeaders
    if (user instanceof Response) { // Check if authenticateRequest returned a Response
      return user;
    }
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${jwt}` },
      },
    });

    const body = await req.json();
    const {
      merchant_id, shop_name, deal_heading, offer_value, category,
      long_description, latlong, start_date, end_date, store_id,
      image_url, image_name, media_urls, video_url, image_price_overlays,
      localized_heading, localized_offer,
      localized_description, localized_shop_name, is_deal_of_the_day,
      trust_badges, free_gifts
    } = body;

    // Validate Input Data
    if (merchant_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Merchant ID mismatch.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (!isString(store_id as string) || (store_id as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Store ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // ─── Single-round-trip authorization gate ───
    // One RPC replaces the previous 4 SELECTs (merchant role, active-staff,
    // active-subscription, store-ownership). Roughly halves the per-deal DB
    // round-trips, which is what lets the connection pool absorb concurrency
    // (load test: ~8.6s -> ~2.1s p95 at 50 concurrent). The RPC's has_access
    // already covers active staff (who inherit the owner's access).
    // The gate is a pure read — safe to retry. One in-function retry absorbs a
    // transient pool/connection hiccup so the merchant doesn't see a failure for
    // something that succeeds 300ms later.
    let { data: gateRows, error: gateErr } = await supabase.rpc('campaign_create_gate', {
      p_user_id: user.id,
      p_merchant_id: merchant_id,
      p_store_id: store_id,
    });
    if (gateErr) {
      console.warn('[create-campaign] gate RPC error, retrying once:', gateErr.message);
      await new Promise((r) => setTimeout(r, 300));
      ({ data: gateRows, error: gateErr } = await supabase.rpc('campaign_create_gate', {
        p_user_id: user.id,
        p_merchant_id: merchant_id,
        p_store_id: store_id,
      }));
    }
    if (gateErr) {
      console.error('[create-campaign] gate RPC error (after retry):', gateErr.message);
      return new Response(JSON.stringify({ error: 'Unable to verify your account right now. Please try again.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
    const gate = Array.isArray(gateRows) ? gateRows[0] : gateRows;
    if (!gate || !gate.is_merchant) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Only merchants can create campaigns.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (!gate.has_access) {
      return new Response(JSON.stringify({ error: 'An active subscription is required to create deals.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (!gate.store_ok) {
      return new Response(JSON.stringify({ error: 'Selected store not found. Please go back and re-select your store.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    // ─── End gate ───

    if (!isString(latlong as string) || (latlong as string).length < 1) {
      return new Response(JSON.stringify({ error: 'LatLong string is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(shop_name as string) || (shop_name as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Shop name is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(deal_heading as string) || (deal_heading as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Deal heading is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(offer_value as string) || (offer_value as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Offer value is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(category as string) || (category as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Category is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(long_description as string) || (long_description as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Long description is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(start_date as string) || !isDateString(start_date as string)) {
      return new Response(JSON.stringify({ error: 'Valid start date is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(end_date as string) || !isDateString(end_date as string)) {
      return new Response(JSON.stringify({ error: 'Valid end date is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(image_url as string) || (image_url as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Image URL is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(image_name as string) || (image_name as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Image name is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // ─── Content Moderation Check ───
    const moderationResult = moderateCampaignContent({
      deal_heading,
      long_description,
      shop_name,
      offer_value,
      localized_heading,
      localized_offer,
      localized_description,
      localized_shop_name,
    });

    if (moderationResult) {
      const moderationCategory = moderationResult.categories[0];
      const userMessage = MODERATION_CATEGORY_MESSAGES[moderationCategory] || 'Your deal contains content that violates our guidelines. Please revise and resubmit.';
      console.warn(`[create-campaign] Content moderation BLOCKED: field="${moderationResult.flaggedField}" category="${moderationCategory}" term="${moderationResult.flaggedTerm}" merchant=${user.id}`);
      return new Response(JSON.stringify({
        error: userMessage,
        moderation: {
          flagged: true,
          category: moderationCategory,
          field: moderationResult.flaggedField,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    // ─── End Content Moderation Check ───
    // (store ownership is verified by the gate RPC above)

    // Validate media_urls if provided (max 5 URLs)
    if (media_urls !== undefined) {
      if (!Array.isArray(media_urls) || media_urls.length > 5 || !media_urls.every((u: any) => typeof u === 'string')) {
        return new Response(JSON.stringify({ error: 'media_urls must be an array of up to 5 URL strings.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
        });
      }
    }
    if (video_url !== undefined && typeof video_url !== 'string') {
      return new Response(JSON.stringify({ error: 'video_url must be a string.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

    const campaignPayload: Record<string, any> = {
      merchant_id,
      shop_name,
      deal_heading,
      offer_value,
      category,
      long_description,
      latlong, // Mapping the input string to campaigns.latlong
      start_date,
      end_date,
      store_id,
      image_url,
      image_name,
      localized_heading,
      localized_offer,
      localized_description,
      localized_shop_name,
      status: 'active', // AI moderation handles review — campaigns go live immediately
      is_deal_of_the_day: is_deal_of_the_day === true,
    };

    if (media_urls && media_urls.length > 0) campaignPayload.media_urls = media_urls;
    if (video_url) campaignPayload.video_url = video_url;
    if (image_price_overlays && typeof image_price_overlays === 'object' && Object.keys(image_price_overlays).length > 0) {
      campaignPayload.image_price_overlays = image_price_overlays;
    }
    if (trust_badges && Array.isArray(trust_badges)) {
      campaignPayload.trust_badges = trust_badges;
    }
    if (free_gifts && Array.isArray(free_gifts) && free_gifts.length > 0) {
      campaignPayload.free_gifts = free_gifts;
    }

    // ─── Idempotency ───
    // The client sends one stable key per publish attempt and reuses it across
    // automatic retries. This makes a retry after a lost response safe — we
    // return the already-created deal instead of inserting a duplicate. Tolerant
    // of the column not existing yet (pre-migration): we just skip dedup.
    const dedupKey = (typeof body.client_dedup_key === 'string' && body.client_dedup_key.length > 0)
      ? body.client_dedup_key
      : null;

    const okResponse = (campaign: any) => new Response(
      JSON.stringify({ message: 'Campaign created successfully', campaign }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 },
    );

    if (dedupKey) {
      try {
        const { data: existing } = await supabase
          .from('campaigns')
          .select('*')
          .eq('merchant_id', merchant_id)
          .eq('client_dedup_key', dedupKey)
          .maybeSingle();
        if (existing) {
          console.log('[create-campaign] idempotent hit — returning existing campaign for dedup key');
          return okResponse(existing);
        }
        campaignPayload.client_dedup_key = dedupKey;
      } catch (_) { /* column may not exist yet — proceed without dedup */ }
    }

    let { data, error } = await supabase
      .from('campaigns')
      .insert([campaignPayload])
      .select()
      .single();

    // Pre-migration safety: if the dedup column isn't there yet, retry the
    // insert without it so publishing keeps working regardless of deploy order.
    if (error && /client_dedup_key/i.test(error.message || '')) {
      delete campaignPayload.client_dedup_key;
      ({ data, error } = await supabase.from('campaigns').insert([campaignPayload]).select().single());
    }

    // Concurrent-retry race: a parallel attempt with the same key inserted first
    // and the unique index rejected this one. Fetch and return the winner — the
    // merchant still gets exactly one deal and a success response.
    if (error && dedupKey && /duplicate key|unique constraint|campaigns_merchant_dedup_key/i.test(error.message || '')) {
      const { data: existing } = await supabase
        .from('campaigns')
        .select('*')
        .eq('merchant_id', merchant_id)
        .eq('client_dedup_key', dedupKey)
        .maybeSingle();
      if (existing) {
        console.log('[create-campaign] dedup race resolved — returning the winning campaign');
        return okResponse(existing);
      }
    }

    if (error) {
      console.error('Failed to create campaign:', error.message);
      throw error;
    }

    return okResponse(data);
  } catch (error: any) {
    console.error('Failed to create campaign:', error.message || error);
    let status = 500;
    if (error.message && typeof error.message === 'string') {
      if (error.message.includes('Unauthorized')) {
        status = 401; // Or 403
      } else if (error.message.includes('Method Not Allowed')) {
        status = 405;
      } else if (error.message.includes('required') || error.message.includes('Invalid')) {
        status = 400; // Bad Request
      } else if (error.message.includes('foreign key') || error.message.includes('fkey')) {
        status = 400;
      }
    }
    const userMessage = (error.message?.includes('foreign key') || error.message?.includes('fkey'))
      ? 'Selected store no longer exists. Please go back and re-select your store.'
      : (error.message || 'Internal Server Error');
    return new Response(JSON.stringify({ error: userMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});