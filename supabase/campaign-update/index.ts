import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// ─── Content Moderation ──────────────────────────────────────────────
// Multi-category moderation for merchant deal content.
// Categories: profanity, sexual, hate_speech, harassment

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
    'i will kill', 'i\'ll kill', 'gonna kill', 'want to kill',
    'i will hurt', 'gonna hurt', 'beat you', 'beat the',
    'threaten', 'threat', 'stalk', 'stalking',
    'rape', 'rapist', 'molest',
    'bomb', 'bombing', 'attack', 'shoot', 'shooting',
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

const MODERABLE_FIELDS = [
  'deal_heading', 'long_description', 'shop_name', 'offer_value',
  'localized_heading', 'localized_offer', 'localized_description', 'localized_shop_name',
];
// ─── End Content Moderation ──────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization')!;

    if (!supabaseServiceKey) {
       throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY secret.");
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Get User and Profile
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: profile } = await userClient
      .from('merchant_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'merchant') {
      return new Response(JSON.stringify({ error: 'Forbidden: Merchant access required' }), { status: 403, headers: corsHeaders });
    }

    // Robust staff lockout: block a suspended/removed staff member (false only when
    // the user has staff rows but none active). Fail-open on null.
    const { data: __actorOk } = await userClient.rpc('merchant_is_active_actor', { p_user_id: user.id });
    if (__actorOk === false) {
      return new Response(JSON.stringify({ error: 'ACCESS_DISABLED', message: 'Your access has been disabled by the store owner.' }), { status: 403, headers: corsHeaders });
    }

    // 2. Parse Body
    const body = await req.json();
    const { campaign_id, ...updates } = body;

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id is required' }), { status: 400, headers: corsHeaders });
    }

    // 3. Security Check: Merchant can only update their own campaigns
    const { data: campaign } = await userClient
      .from('campaigns')
      .select('merchant_id')
      .eq('campaign_id', campaign_id)
      .single();

    if (campaign?.merchant_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: Ownership mismatch' }), { status: 403, headers: corsHeaders });
    }

    // 4. Content Moderation — only check text fields being updated
    const fieldsToModerate: Record<string, string | undefined> = {};
    for (const field of MODERABLE_FIELDS) {
      if (typeof updates[field] === 'string' && updates[field].trim().length > 0) {
        fieldsToModerate[field] = updates[field];
      }
    }

    if (Object.keys(fieldsToModerate).length > 0) {
      const moderationResult = moderateCampaignContent(fieldsToModerate);
      if (moderationResult) {
        const category = moderationResult.categories[0];
        const userMessage = MODERATION_CATEGORY_MESSAGES[category] || 'Your deal contains content that violates our guidelines. Please revise and resubmit.';
        console.warn(`[campaign-update] Content moderation BLOCKED: field="${moderationResult.flaggedField}" category="${category}" term="${moderationResult.flaggedTerm}" campaign=${campaign_id} user=${user!.id}`);
        return new Response(JSON.stringify({
          error: userMessage,
          moderation: { flagged: true, category, field: moderationResult.flaggedField },
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 5. Clean Payload
    const cleanPayload = {
      ...updates,
      modified_at: new Date().toISOString(),
      last_modified: new Date().toISOString()
    };

    // 6. Execute with Service Role (Bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error: updateError } = await adminClient
      .from('campaigns')
      .update(cleanPayload)
      .eq('campaign_id', campaign_id)
      .select()
      .single();

    if (updateError) {
      console.error("Database Update Error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, campaign: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Edge Function Exception:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
