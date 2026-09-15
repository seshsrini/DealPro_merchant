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

const nameOf = (names: any, pincode: string): string =>
  (names && (names.en || names['en'])) || (names && Object.values(names).find((v) => typeof v === 'string')) || pincode;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Given a merchant store's pincode (and optionally city/locality), return the
 * store's own area plus the geographically nearest areas in the same city, so
 * the merchant can target a small cluster of neighbourhoods. Nearest first,
 * store's area first, capped at 12 candidates. Falls back to pincode-number
 * proximity when coordinates are missing, and to same-city listing when the
 * store's pincode isn't in the locality registry.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Any authenticated user may look up areas (no sensitive data returned).
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const b = await req.json().catch(() => ({}));
    const pincode = String(b.pincode ?? '').trim();
    const cityHint = String(b.city ?? '').trim();
    const localityHint = String(b.locality ?? '').trim();
    if (!pincode && !cityHint) return json({ city: cityHint || null, anchorPincode: null, areas: [] });

    // 1. Resolve the anchor: the store's own locality row (for coords + city_id).
    let anchor: any = null;
    if (pincode) {
      const { data } = await admin.from('localities')
        .select('id, city_id, pincode, names, latitude, longitude')
        .eq('pincode', pincode).limit(10);
      const rows = data || [];
      anchor = rows.find((r: any) => r.latitude != null && r.longitude != null) || rows[0] || null;
    }

    // 2. Resolve the city_id to gather candidates from.
    let cityId: number | null = anchor?.city_id ?? null;
    let cityName: string | null = cityHint || null;
    if (!cityId && cityHint) {
      const langs = ['en', 'hi', 'kn', 'ta', 'te', 'ml', 'bn', 'mr', 'gu'];
      const orf = langs.map((l) => `names->>${l}.ilike.%${cityHint.split(',')[0].trim()}%`).join(',');
      const { data: cities } = await admin.from('cities').select('id, names').or(orf).limit(1);
      if (cities && cities[0]) { cityId = cities[0].id; cityName = nameOf(cities[0].names, cityHint); }
    }
    // Last-ditch: derive the city from the pincode directory.
    if (!cityId && pincode) {
      const { data: pd } = await admin.from('pincode_directory')
        .select('city').eq('pincode', pincode).limit(1).maybeSingle();
      if (pd?.city) cityName = pd.city;
    }
    if (cityId && !cityName) {
      const { data: c } = await admin.from('cities').select('names').eq('id', cityId).maybeSingle();
      if (c) cityName = nameOf(c.names, cityHint || '');
    }

    // 3. Gather candidate areas in the same city.
    let candidates: any[] = [];
    if (cityId != null) {
      const { data } = await admin.from('localities')
        .select('pincode, names, latitude, longitude')
        .eq('city_id', cityId).limit(400);
      candidates = data || [];
    }

    // Build the ranked area list.
    const anchorPin = anchor?.pincode || pincode || null;
    const seen = new Set<string>();
    const push = (arr: { locality: string; pincode: string }[], locality: string, pin: string) => {
      const key = locality.trim().toLowerCase();
      if (!locality || seen.has(key)) return;
      seen.add(key); arr.push({ locality: locality.trim(), pincode: pin });
    };

    const ranked: { locality: string; pincode: string }[] = [];
    // Store's own area always first.
    if (anchor) push(ranked, nameOf(anchor.names, anchor.pincode), anchor.pincode);
    else if (localityHint) push(ranked, localityHint, pincode);

    const rest = candidates
      .filter((c: any) => c.pincode !== anchorPin || nameOf(c.names, c.pincode).toLowerCase() !== (ranked[0]?.locality || '').toLowerCase())
      .map((c: any) => {
        let dist = Number.POSITIVE_INFINITY;
        if (anchor?.latitude != null && c.latitude != null) {
          dist = haversineKm(anchor.latitude, anchor.longitude, c.latitude, c.longitude);
        } else if (anchorPin) {
          dist = Math.abs(parseInt(c.pincode, 10) - parseInt(anchorPin, 10)) || 0;
        }
        return { locality: nameOf(c.names, c.pincode), pincode: c.pincode, dist };
      })
      .sort((a, b) => a.dist - b.dist);

    for (const r of rest) { if (ranked.length >= 12) break; push(ranked, r.locality, r.pincode); }

    return json({ city: cityName, anchorPincode: anchorPin, areas: ranked });
  } catch (e) {
    console.error('[get-nearby-areas] error:', e);
    return json({ city: null, anchorPincode: null, areas: [] });
  }
});
