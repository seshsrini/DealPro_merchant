/**
 * productLookupService.ts
 * Product lookups via the product-search edge function (SerpApi Google Shopping).
 * All requests go through Supabase edge function — API key stays server-side.
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

import { supabase } from './supabaseClient';

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_KEY;

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

// ── Core search (via edge function — works uniformly across all devices) ──────

async function searchGoogleShopping(
  query: string,
  schemaId: string,
  limit = 6
): Promise<ProductData[]> {
  try {
    // Try supabase.functions.invoke first (uses user session)
    let data: any = null;
    try {
      const resp = await supabase.functions.invoke('product-search', {
        body: { query, limit },
      });
      if (!resp.error) data = resp.data;
    } catch {}

    // Fallback: direct fetch with anon key only (no JWT required — function has no auth)
    if (!data && SUPABASE_URL && SUPABASE_ANON_KEY) {
      console.log('[productLookupService] Trying direct fetch fallback...');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/product-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ query, limit }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) data = await res.json();
    }

    if (!data) return [];

    const results: any[] = data?.shopping_results ?? [];
    return results
      .slice(0, limit)
      .map(r => normalizeSerpResult(r, schemaId))
      .filter(p => p.name.trim() !== '');
  } catch (err) {
    console.warn('[productLookupService] Search failed:', err);
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
