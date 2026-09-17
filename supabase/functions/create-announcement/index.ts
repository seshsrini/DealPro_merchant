// @ts-ignore
declare const Deno: { env: { get(k: string): string | undefined }; serve: (h: (r: Request) => Promise<Response> | Response) => void };
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const RADIUS_KM = 5;
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Every pincode within RADIUS_KM of any of the given store locations, resolved
 *  from the localities registry. Used to reach consumers near the store even
 *  when their exact pincode wasn't one of the merchant's picked areas. */
async function radiusPincodes(admin: any, stores: any[]): Promise<string[]> {
  const out = new Set<string>();
  for (const s of stores) {
    const lat = Number(s.latitude), lng = Number(s.longitude);
    if (s.pincode) out.add(String(s.pincode).trim());
    if (!lat || !lng) continue; // missing/0,0 coords → pincode only
    const prefix = String(s.pincode || '').slice(0, 3);
    const q = admin.from('localities').select('pincode, latitude, longitude').limit(3000);
    const { data: locs } = prefix ? await q.like('pincode', `${prefix}%`) : await q;
    for (const l of locs || []) {
      if (l.latitude != null && l.longitude != null && l.pincode &&
          haversineKm(lat, lng, Number(l.latitude), Number(l.longitude)) <= RADIUS_KM) {
        out.add(String(l.pincode).trim());
      }
    }
  }
  return [...out].filter(Boolean);
}

// ─── Content Moderation ──────────────────────────────────────────────
// Same word-list gate used for merchant deals (create-campaign), so
// announcements are held to the identical standard. English + Hindi/Hinglish
// + regional Indian languages. Authoritative server-side check; the wizard
// also runs an AI check for instant feedback.
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

function moderateText(text: string): string | null {
  if (!text || text.trim().length === 0) return null;
  const normalized = normalizeForModeration(text);
  for (const [category, terms] of Object.entries(MODERATION_LISTS)) {
    for (const term of terms) {
      const termNorm = normalizeForModeration(term);
      const hit = termNorm.includes(' ')
        ? normalized.includes(termNorm)
        : new RegExp(`\\b${termNorm}\\b`).test(normalized);
      if (hit) return category;
    }
  }
  return null;
}

const MODERATION_MESSAGES: Record<string, string> = {
  profanity: 'Your announcement contains inappropriate language. Please remove profanity and resubmit.',
  sexual: 'Your announcement contains sexual content which is not allowed. Please revise and resubmit.',
  hate_speech: 'Your announcement contains hateful or discriminatory language. Please revise and resubmit.',
  harassment: 'Your announcement contains threatening or harassing language. Please revise and resubmit.',
};
// ─── End Content Moderation ──────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Body is parsed up-front so a usage check (`{ check: true }`) can return the
    // merchant's allowance/usage without going through the create path.
    const b = await req.json().catch(() => ({}));
    const checkOnly = b?.check === true;

    // 1. Auth — merchant only.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);
    const merchantId = user.id;
    const { data: prof } = await admin.from('merchant_profiles').select('role').eq('id', merchantId).maybeSingle();
    if (!prof || prof.role !== 'merchant') return json({ error: 'Forbidden: merchant access required' }, 403);

    // 2. Active subscription + tier announcement allowance.
    const { data: sub } = await admin.from('merchant_subscriptions')
      .select('plan_name, current_period_start, current_period_end')
      .eq('merchant_id', merchantId).eq('status', 'active')
      .gte('current_period_end', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!sub?.plan_name) {
      if (checkOnly) return json({ success: true, usage: { limit: 0, used: 0, remaining: 0, hasSubscription: false } });
      return json({ error: 'No active plan. Announcements need a paid plan.' }, 403);
    }
    const { data: tier } = await admin.from('subscription_tiers')
      .select('max_announcements_per_month').eq('tier_key', sub.plan_name).maybeSingle();
    const maxPerMonth = Number(tier?.max_announcements_per_month ?? 0);
    if (maxPerMonth <= 0) {
      if (checkOnly) return json({ success: true, usage: { limit: 0, used: 0, remaining: 0, hasSubscription: true } });
      return json({ error: 'Your plan does not include announcements. Upgrade to send them.' }, 403);
    }

    // 3. Billing-window start — identical anchor math to campaign_usage, so
    //    announcements reset on the merchant's billing anniversary like deals.
    const IST = 5.5 * 3600 * 1000;
    const anchorSrc = sub.current_period_start || sub.current_period_end || null;
    const anchorDay = anchorSrc ? new Date(new Date(anchorSrc).getTime() + IST).getUTCDate() : 1;
    const clampDay = (y: number, m: number, d: number) => Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
    const istNow = new Date(Date.now() + IST);
    let wy = istNow.getUTCFullYear(), wm = istNow.getUTCMonth();
    if (istNow.getUTCDate() < clampDay(wy, wm, anchorDay)) { wm -= 1; if (wm < 0) { wm = 11; wy -= 1; } }
    let windowStart = new Date(Date.UTC(wy, wm, clampDay(wy, wm, anchorDay)) - IST).toISOString();
    if (sub.current_period_start && sub.current_period_start > windowStart) windowStart = sub.current_period_start;

    const { count } = await admin.from('announcements')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId).gte('created_at', windowStart);
    const used = count ?? 0;

    if (checkOnly)
      return json({ success: true, usage: { limit: maxPerMonth, used, remaining: Math.max(0, maxPerMonth - used), hasSubscription: true } });

    if (used >= maxPerMonth)
      return json({ error: `Monthly announcement limit reached (${maxPerMonth}). It resets on your next billing cycle.` }, 403);

    // 4. Validate input.
    const title = String(b.title ?? '').trim();
    const description = String(b.description ?? '').trim();
    if (!title || title.length > 30) return json({ error: 'Title is required and must be 30 characters or fewer.' }, 400);
    if (!description || description.length > 200) return json({ error: 'Description is required and must be 200 characters or fewer.' }, 400);

    // Content moderation — reject profane / sexual / hateful / harassing text.
    const badCategory = moderateText(title) || moderateText(description);
    if (badCategory) return json({ error: MODERATION_MESSAGES[badCategory] || MODERATION_MESSAGES.profanity }, 400);

    // Store selection + optional contact display. store_id null => all stores.
    const ownStores = new Set(
      ((await admin.from('merchant_stores').select('id').eq('merchant_id', merchantId)).data || [])
        .map((s: { id: string }) => s.id),
    );
    const storeId = b.store_id ? String(b.store_id) : null;
    if (storeId && !ownStores.has(storeId)) return json({ error: 'Invalid store selection.' }, 400);
    const showStoreContact = b.show_store_contact === true;
    let contactStoreId: string | null = b.contact_store_id ? String(b.contact_store_id) : (storeId || null);
    if (showStoreContact) {
      if (!contactStoreId) return json({ error: 'Choose which store\'s address to show.' }, 400);
      if (!ownStores.has(contactStoreId)) return json({ error: 'Invalid store for contact details.' }, 400);
    } else {
      contactStoreId = null;
    }
    const targetType = b.target_type === 'city' ? 'city' : b.target_type === 'area' ? 'area' : null;
    if (!targetType) return json({ error: 'Audience is required.' }, 400);

    // Area audience: 1..3 nearby areas (locality + pincode arrays, kept parallel).
    let pincodes: string[] = [];
    let localities: string[] = [];
    let city: string | null = null;
    if (targetType === 'area') {
      pincodes = (Array.isArray(b.target_pincodes) ? b.target_pincodes : [])
        .map((p: unknown) => String(p ?? '').trim()).filter(Boolean);
      localities = (Array.isArray(b.target_localities) ? b.target_localities : [])
        .map((l: unknown) => String(l ?? '').trim());
      if (pincodes.length < 1) return json({ error: 'Pick at least one area.' }, 400);
      if (pincodes.length > 3) return json({ error: 'You can target at most 3 areas.' }, 400);
      // Keep localities parallel to pincodes (pad/truncate defensively).
      localities = pincodes.map((_, i) => localities[i] || '');
    } else {
      city = String(b.target_city ?? '').trim();
      if (!city) return json({ error: 'City audience needs a city.' }, 400);
    }

    // For area audiences, expand to every pincode within RADIUS_KM of the
    // relevant store(s) — the selected store, or all of the merchant's stores
    // when "All stores" is chosen — plus the merchant's explicitly picked areas.
    // This is what makes announcements reach nearby consumers like local deals do.
    let matchPincodes: string[] = [];
    if (targetType === 'area') {
      const { data: stores } = storeId
        ? await admin.from('merchant_stores').select('latitude, longitude, pincode').eq('id', storeId)
        : await admin.from('merchant_stores').select('latitude, longitude, pincode').eq('merchant_id', merchantId);
      const radius = await radiusPincodes(admin, stores || []);
      matchPincodes = [...new Set([...pincodes, ...radius])].filter(Boolean);
    }

    // send_to is server-enforced to send_from + 2 days (3-day inclusive window),
    // never trusted from the client.
    const sendFrom = String(b.send_from ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sendFrom)) return json({ error: 'A valid start date is required.' }, 400);
    const sendToDate = new Date(sendFrom + 'T00:00:00Z');
    sendToDate.setUTCDate(sendToDate.getUTCDate() + 2);
    const sendTo = sendToDate.toISOString().slice(0, 10);

    // 5. Insert.
    const { data: row, error: insErr } = await admin.from('announcements').insert({
      merchant_id: merchantId,
      store_id: storeId,
      show_store_contact: showStoreContact,
      contact_store_id: contactStoreId,
      title, description,
      image_url: b.image_url ?? null,
      linked_campaign_id: b.linked_campaign_id ?? null,
      send_from: sendFrom, send_to: sendTo,
      target_type: targetType,
      target_city: targetType === 'city' ? city : null,
      target_localities: targetType === 'area' ? localities : null,
      target_pincodes: targetType === 'area' ? pincodes : null,
      match_pincodes: targetType === 'area' ? matchPincodes : null,
    }).select().single();
    if (insErr) return json({ error: insErr.message }, 500);

    // 6. Fire the consumer push (best-effort; never block creation on it).
    try {
      const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-announcement-notification`;
      await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
        body: JSON.stringify({ announcement_id: row.id }),
      });
    } catch (e) { console.warn('[create-announcement] notification dispatch failed:', e); }

    return json({ success: true, announcement: row, remaining: Math.max(0, maxPerMonth - used - 1) });
  } catch (e) {
    console.error('[create-announcement] error:', e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
