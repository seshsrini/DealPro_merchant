// create-campaign-fast — A/B variant of create-campaign that replaces the 4
// separate authorization SELECTs (role / staff / subscription / store) with ONE
// `campaign_create_gate` RPC. Everything else (validation, moderation, insert)
// is identical, so a load-test comparison isolates the round-trip reduction.
//
// @ts-ignore: Deno is a global in the Deno runtime.
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

function isString(value: any): boolean {
  return typeof value === 'string';
}
function isDateString(value: string): boolean {
  return !isNaN(new Date(value).getTime());
}

// ─── Content Moderation (identical to create-campaign) ───────────────────
interface ModerationResult {
  flagged: boolean;
  categories: string[];
  flaggedField: string;
  flaggedTerm: string;
}
const MODERATION_LISTS: Record<string, string[]> = {
  profanity: [
    'fuck', 'fucking', 'fucker', 'fck', 'f u c k', 'shit', 'shitty', 'bullshit',
    'bitch', 'bitchy', 'damn', 'damned', 'crap', 'crappy', 'piss', 'pissed',
    'bastard', 'ass', 'asshole', 'arsehole', 'arse', 'dumbass', 'jackass',
    'wtf', 'stfu', 'lmfao',
    'chutiya', 'chutiye', 'madarchod', 'mc', 'bhenchod', 'bc', 'bhosdike',
    'bhosdiwale', 'gaand', 'gandu', 'lund', 'lauda', 'laude', 'randi',
    'harami', 'haramkhor', 'kutiya', 'kutte', 'sala', 'saala', 'saale',
    'ullu', 'gadha', 'bewakoof', 'kamina', 'kamine', 'kameena', 'kameene',
    'tatti', 'hagne', 'jhant', 'jhatu', 'chut', 'bhadwa', 'bhadwe',
    'sule', 'magne', 'mundaige', 'bolimaga',
    'thevdiya', 'sunni', 'punda', 'oombu',
    'dengey', 'pooku', 'modda', 'lanja', 'lanjakodaka',
  ],
  sexual: [
    'porn', 'porno', 'pornography', 'xxx', 'nude', 'nudes', 'naked', 'sex',
    'sexy', 'sexual', 'orgasm', 'erotic', 'erotica', 'dildo', 'vibrator',
    'masturbat', 'penis', 'vagina', 'boobs', 'tits', 'nipple', 'blowjob',
    'handjob', 'anal', 'cumshot', 'hentai', 'milf', 'stripper', 'escort',
    'prostitut', 'brothel', 'hookup', 'onlyfans',
    'chod', 'chodna', 'chudai', 'muth', 'muthhal', 'nanga', 'nangi',
  ],
  hate_speech: [
    'nigger', 'nigga', 'faggot', 'fag', 'dyke', 'tranny', 'retard', 'retarded',
    'spastic', 'cripple',
    'chamaar', 'chamar', 'bhangi', 'chuhra', 'mlechha', 'kaffir', 'kafir',
    'kill all', 'death to', 'go back to', 'gas the', 'hang all',
  ],
  harassment: [
    'i will kill', "i'll kill", 'gonna kill', 'want to kill',
    'i will hurt', 'gonna hurt', 'beat you up', 'i will beat you',
    'threaten', 'threat', 'stalk', 'stalking',
    'rape', 'rapist', 'molest',
    'bomb', 'bombing', 'attack', 'shoot', 'shooting',
    'kys', 'kill yourself', 'go die',
  ],
};
function normalizeForModeration(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@]/g, 'a').replace(/[1!|]/g, 'i').replace(/[3]/g, 'e')
    .replace(/[0]/g, 'o').replace(/[5\$]/g, 's').replace(/[7]/g, 't')
    .replace(/[^a-z\s']/g, ' ').replace(/\s+/g, ' ').trim();
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
// ─── End Moderation ──────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!jwt) return json({ error: 'Unauthorized: No access token provided.' }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !user) return json({ error: 'Unauthorized: Invalid or expired token.' }, 401);

    const body = await req.json();
    const {
      merchant_id, shop_name, deal_heading, offer_value, category,
      long_description, latlong, start_date, end_date, store_id,
      image_url, image_name, media_urls, video_url, image_price_overlays,
      localized_heading, localized_offer,
      localized_description, localized_shop_name, is_deal_of_the_day,
      trust_badges, free_gifts,
    } = body;

    if (merchant_id !== user.id) return json({ error: 'Unauthorized: Merchant ID mismatch.' }, 403);
    if (!isString(store_id as string) || (store_id as string).length < 1) {
      return json({ error: 'Store ID is required.' }, 400);
    }

    // ─── Single-round-trip authorization gate (role + access + store) ───
    const { data: gateRows, error: gateErr } = await supabase.rpc('campaign_create_gate', {
      p_user_id: user.id,
      p_merchant_id: merchant_id,
      p_store_id: store_id,
    });
    // Surface the REAL reason — a missing/renamed function, a permissions issue,
    // or a cast error all show up here. Masking this as "store not found" makes
    // an unconfigured RPC indistinguishable from a genuinely bad store.
    if (gateErr) {
      console.error('[create-campaign-fast] gate RPC error:', gateErr.message);
      return json({ error: `gate_rpc_error: ${gateErr.message}` }, 500);
    }
    const gate = Array.isArray(gateRows) ? gateRows[0] : gateRows;
    if (!gate) return json({ error: 'gate_rpc_no_rows' }, 500);
    if (!gate.is_merchant) return json({ error: 'Unauthorized: Only merchants can create campaigns.' }, 403);
    if (!gate.has_access) return json({ error: 'An active subscription is required to create deals.' }, 403);
    if (!gate.store_ok) {
      // Include the gate booleans so a store-check bug is distinguishable from a
      // real missing store during load testing.
      return json({
        error: `store_not_found (gate is_merchant=${gate.is_merchant} has_access=${gate.has_access} store_ok=${gate.store_ok})`,
      }, 400);
    }
    // ─── End gate ───

    // Field validation (identical to create-campaign)
    if (!isString(latlong as string) || (latlong as string).length < 1) return json({ error: 'LatLong string is required.' }, 400);
    if (!isString(shop_name as string) || (shop_name as string).length < 1) return json({ error: 'Shop name is required.' }, 400);
    if (!isString(deal_heading as string) || (deal_heading as string).length < 1) return json({ error: 'Deal heading is required.' }, 400);
    if (!isString(offer_value as string) || (offer_value as string).length < 1) return json({ error: 'Offer value is required.' }, 400);
    if (!isString(category as string) || (category as string).length < 1) return json({ error: 'Category is required.' }, 400);
    if (!isString(long_description as string) || (long_description as string).length < 1) return json({ error: 'Long description is required.' }, 400);
    if (!isString(start_date as string) || !isDateString(start_date as string)) return json({ error: 'Valid start date is required.' }, 400);
    if (!isString(end_date as string) || !isDateString(end_date as string)) return json({ error: 'Valid end date is required.' }, 400);
    if (!isString(image_url as string) || (image_url as string).length < 1) return json({ error: 'Image URL is required.' }, 400);
    if (!isString(image_name as string) || (image_name as string).length < 1) return json({ error: 'Image name is required.' }, 400);

    // Moderation
    const moderationResult = moderateCampaignContent({
      deal_heading, long_description, shop_name, offer_value,
      localized_heading, localized_offer, localized_description, localized_shop_name,
    });
    if (moderationResult) {
      const moderationCategory = moderationResult.categories[0];
      const userMessage = MODERATION_CATEGORY_MESSAGES[moderationCategory] || 'Your deal contains content that violates our guidelines. Please revise and resubmit.';
      return json({
        error: userMessage,
        moderation: { flagged: true, category: moderationCategory, field: moderationResult.flaggedField },
      }, 400);
    }

    if (media_urls !== undefined) {
      if (!Array.isArray(media_urls) || media_urls.length > 5 || !media_urls.every((u: any) => typeof u === 'string')) {
        return json({ error: 'media_urls must be an array of up to 5 URL strings.' }, 400);
      }
    }
    if (video_url !== undefined && typeof video_url !== 'string') {
      return json({ error: 'video_url must be a string.' }, 400);
    }

    const campaignPayload: Record<string, any> = {
      merchant_id, shop_name, deal_heading, offer_value, category, long_description,
      latlong, start_date, end_date, store_id, image_url, image_name,
      localized_heading, localized_offer, localized_description, localized_shop_name,
      status: 'active',
      is_deal_of_the_day: is_deal_of_the_day === true,
    };
    if (media_urls && media_urls.length > 0) campaignPayload.media_urls = media_urls;
    if (video_url) campaignPayload.video_url = video_url;
    if (image_price_overlays && typeof image_price_overlays === 'object' && Object.keys(image_price_overlays).length > 0) {
      campaignPayload.image_price_overlays = image_price_overlays;
    }
    if (trust_badges && Array.isArray(trust_badges)) campaignPayload.trust_badges = trust_badges;
    if (free_gifts && Array.isArray(free_gifts) && free_gifts.length > 0) campaignPayload.free_gifts = free_gifts;

    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaignPayload])
      .select()
      .single();

    if (error) {
      console.error('[create-campaign-fast] insert failed:', error.message);
      throw error;
    }

    return json({ message: 'Campaign created successfully', campaign: data }, 201);
  } catch (error: any) {
    const msg = error?.message || 'Internal Server Error';
    const userMessage = (msg.includes('foreign key') || msg.includes('fkey'))
      ? 'Selected store no longer exists. Please go back and re-select your store.'
      : msg;
    return json({ error: userMessage }, 500);
  }
});
