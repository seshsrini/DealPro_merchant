import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * get-store-consumer-reach
 *
 * INTEL: for each of a merchant's stores, how many Sreshta consumers are signed
 * up in that store's area. Consumer profiles currently store a city (not
 * coordinates), so this is a CITY-level count today — the honest, available
 * metric. Once consumers carry a home pincode, this can become a true 5 km
 * radius (pincode → coords → distance). Owner/merchant data only; service role.
 *
 * Body: { merchantId }
 * Returns: { rows: [{ store_id, store_name, city, state, locality, consumer_count }] }
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { merchantId } = await req.json().catch(() => ({}));
    if (!merchantId) return json({ error: 'merchantId is required' }, 400);

    // The merchant's stores.
    const { data: stores, error: storeErr } = await supabase
      .from('merchant_stores')
      .select('id, store_name, city, state, locality, pincode')
      .eq('merchant_id', merchantId);
    if (storeErr) throw storeErr;
    if (!stores || stores.length === 0) return json({ rows: [] });

    // Count consumers per DISTINCT city once (a merchant can have several stores
    // in the same city), then map back to each store.
    const distinctCities = [...new Set(
      stores.map((s: any) => String(s.city || '').trim()).filter(Boolean).map((c: string) => c.toLowerCase()),
    )];

    const cityCounts = new Map<string, number>();
    await Promise.all(distinctCities.map(async (cityLc) => {
      // Match on the clean `city` column OR the legacy `home_location` (both hold the
      // city) so existing AND new consumers are counted. ilike is case-insensitive.
      const like = `%${cityLc}%`;
      const { count } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'consumer')
        .or(`city.ilike.${like},home_location.ilike.${like}`);
      cityCounts.set(cityLc, count || 0);
    }));

    const rows = stores.map((s: any) => {
      const cityLc = String(s.city || '').trim().toLowerCase();
      return {
        store_id: s.id,
        store_name: s.store_name || null,
        city: s.city || null,
        state: s.state || null,
        locality: s.locality || null,
        pincode: s.pincode || null,
        consumer_count: cityLc ? (cityCounts.get(cityLc) || 0) : 0,
      };
    });

    return json({ rows });
  } catch (err: any) {
    console.error('[get-store-consumer-reach] Error:', err?.message || err);
    return json({ error: err?.message || 'Internal error' }, 500);
  }
});
