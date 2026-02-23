/**
 * productLookupService.ts
 * All product lookups via SerpApi Google Shopping.
 *
 * Dev (browser): requests go through the Vite proxy (/serpapi → serpapi.com)
 *                to avoid browser CORS restrictions.
 * Prod (Capacitor native): direct call to serpapi.com — CORS doesn't apply to
 *                          native HTTP requests.
 *
 * Requires: VITE_SERPAPI_KEY in .env.local
 */

export interface ProductData {
  name: string;
  brand: string;
  imageUrl: string | null;      // external URL — use as-is, no upload needed
  category: string;             // raw category string from API
  detectedSchemaId: string;     // maps to formSchema CategorySchema.id
  specs: Record<string, string>; // pre-populated field values for the dynamic form
  sourceApi: string;
}

const SERPAPI_KEY = import.meta.env.VITE_SERPAPI_KEY as string;

// In dev the Vite proxy strips /serpapi and forwards to serpapi.com (no CORS).
// In prod the native Capacitor runtime calls serpapi.com directly (no CORS).
const SERPAPI_BASE = import.meta.env.DEV
  ? '/serpapi/search.json'
  : 'https://serpapi.com/search.json';

// ── Normalizer ────────────────────────────────────────────────────────────────

function normalizeSerpResult(result: any, schemaId: string): ProductData {
  return {
    name:             result.title ?? '',
    brand:            result.source ?? '',
    imageUrl:         result.thumbnail ?? null,
    category:         result.snippet ?? '',
    detectedSchemaId: schemaId,
    specs: {
      brand: result.source ?? '',
      price: result.price ?? '',
    },
    sourceApi: 'Google Shopping',
  };
}

// ── Core search ───────────────────────────────────────────────────────────────

async function searchGoogleShopping(
  query: string,
  schemaId: string,
  limit = 6
): Promise<ProductData[]> {
  if (!SERPAPI_KEY) {
    console.warn('[productLookupService] VITE_SERPAPI_KEY is not set');
    return [];
  }
  try {
    const params = new URLSearchParams({
      engine:  'google_shopping',
      q:       query,
      num:     String(limit),
      api_key: SERPAPI_KEY,
      gl:      'in',   // India results
      hl:      'en',   // English
    });
    const res = await fetch(`${SERPAPI_BASE}?${params.toString()}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const results: any[] = json.shopping_results ?? [];
    return results
      .slice(0, limit)
      .map(r => normalizeSerpResult(r, schemaId))
      .filter(p => p.name.trim() !== '');
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up a product by barcode / UPC / ISBN.
 */
export async function lookupByBarcode(barcode: string): Promise<ProductData | null> {
  const clean = barcode.replace(/\s/g, '');
  const results = await searchGoogleShopping(clean, 'general', 1);
  return results[0] ?? null;
}

/**
 * Search a product by name — returns the single best match.
 */
export async function lookupByName(
  name: string,
  schemaId: string = 'general'
): Promise<ProductData | null> {
  const results = await lookupByNameMultiple(name, schemaId);
  return results[0] ?? null;
}

/**
 * Search a product by name — returns up to 6 matches.
 */
export async function lookupByNameMultiple(
  name: string,
  schemaId: string = 'general'
): Promise<ProductData[]> {
  return searchGoogleShopping(name, schemaId, 60);
}

export const productLookupService = { lookupByBarcode, lookupByName, lookupByNameMultiple };
