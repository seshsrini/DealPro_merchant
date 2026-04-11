
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

    // Check if the authenticated user is a merchant
    const { data: userProfile, error: profileError } = await supabase
      .from('merchant_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || userProfile?.role !== 'merchant') {
      console.error(`[campaigns/create-campaign EF] User ${user.id} is not a merchant or profile not found.`);
      return new Response(JSON.stringify({ error: 'Unauthorized: Only merchants can create campaigns.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    const body = await req.json();
    const {
      merchant_id, shop_name, deal_heading, offer_value, category,
      long_description, latlong, start_date, end_date, store_id,
      image_url, image_name, media_urls, video_url, image_price_overlays,
      localized_heading, localized_offer,
      localized_description, localized_shop_name, is_deal_of_the_day
    } = body;

    // Validate Input Data
    if (merchant_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Merchant ID mismatch.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
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
    if (!isString(store_id as string) || (store_id as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Store ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
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

    // Verify store exists and belongs to this merchant before inserting
    const { data: storeCheck, error: storeError } = await supabase
      .from('merchant_stores')
      .select('id')
      .eq('id', store_id)
      .eq('merchant_id', merchant_id)
      .maybeSingle();

    if (storeError || !storeCheck) {
      console.error(`[campaigns/create-campaign EF] Store ${store_id} not found for merchant ${merchant_id}`);
      return new Response(JSON.stringify({ error: 'Selected store not found. Please go back and re-select your store.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      });
    }

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
      latlong,
      start_date,
      end_date,
      store_id,
      image_url,
      image_name,
      localized_heading,
      localized_offer,
      localized_description,
      localized_shop_name,
      status: 'active',
      is_deal_of_the_day: is_deal_of_the_day === true,
    };

    if (media_urls && media_urls.length > 0) campaignPayload.media_urls = media_urls;
    if (video_url) campaignPayload.video_url = video_url;
    if (image_price_overlays && typeof image_price_overlays === 'object' && Object.keys(image_price_overlays).length > 0) {
      campaignPayload.image_price_overlays = image_price_overlays;
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaignPayload])
      .select()
      .single();

    if (error) {
      console.error('Failed to create campaign:', error.message);
      throw error;
    }

    return new Response(JSON.stringify({ message: 'Campaign created successfully', campaign: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });
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