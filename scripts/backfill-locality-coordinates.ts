/**
 * One-time backfill script: Populate latitude/longitude for all localities in the database.
 *
 * Usage:
 *   npx ts-node scripts/backfill-locality-coordinates.ts
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set
 *   - The localities table must already have latitude/longitude columns (run migration first)
 *
 * Strategy:
 *   - Fetches all localities with a pincode but no coordinates
 *   - Groups by unique pincode (many localities share the same pincode)
 *   - Calls Nominatim for each unique pincode (respecting 1 request/second rate limit)
 *   - Updates all locality rows for each pincode in batch
 *
 * India has ~30,000 unique pincodes. At 1 req/sec = ~8.5 hours for full backfill.
 * Run this once, then the geocode-pincode Edge Function handles new lookups on-the-fly.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const NOMINATIM_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'DealProBackfill/1.0',
  'Accept-Language': 'en',
};

// Respect Nominatim rate limit: 1 request per second
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY!,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: ${res.status} ${text}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }
  return null;
}

async function geocodePincode(pincode: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1&accept-language=en`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS });
    const results = await res.json();

    if (results && results[0]) {
      return {
        latitude: parseFloat(results[0].lat),
        longitude: parseFloat(results[0].lon),
      };
    }
    return null;
  } catch (e) {
    console.error(`  [ERROR] Nominatim failed for ${pincode}:`, (e as Error).message);
    return null;
  }
}

async function main() {
  console.log('=== Locality Coordinates Backfill ===\n');

  // Fetch all distinct pincodes that have no coordinates
  console.log('Fetching localities without coordinates...');
  const localities: { pincode: string }[] = await supabaseRequest(
    'localities?select=pincode&latitude=is.null&pincode=not.is.null&order=pincode.asc',
    { headers: { 'Prefer': 'return=representation' } as any }
  );

  // Get unique pincodes
  const uniquePincodes = [...new Set(localities.map(l => l.pincode).filter(p => p && /^\d{6}$/.test(p)))];
  console.log(`Found ${localities.length} localities with ${uniquePincodes.length} unique pincodes to geocode.\n`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < uniquePincodes.length; i++) {
    const pincode = uniquePincodes[i];
    const progress = `[${i + 1}/${uniquePincodes.length}]`;

    const coords = await geocodePincode(pincode);
    if (coords) {
      try {
        await supabaseRequest(
          `localities?pincode=eq.${pincode}&latitude=is.null`,
          {
            method: 'PATCH',
            body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
          }
        );
        console.log(`${progress} ${pincode} → ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)} ✓`);
        success++;
      } catch (e) {
        console.error(`${progress} ${pincode} → DB update failed: ${(e as Error).message}`);
        failed++;
      }
    } else {
      console.warn(`${progress} ${pincode} → No results from Nominatim`);
      skipped++;
    }

    // Rate limit: 1 request per second
    if (i < uniquePincodes.length - 1) {
      await sleep(1100);
    }
  }

  console.log(`\n=== Backfill Complete ===`);
  console.log(`  Success: ${success}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${uniquePincodes.length}`);
}

main().catch(console.error);
