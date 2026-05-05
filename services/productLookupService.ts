/**
 * productLookupService.ts
 * Photo-first product cataloguing via Gemini Vision API.
 * Falls back to legacy SerpAPI-based name search when needed.
 */

import { supabase } from './supabaseClient';

export interface ProductData {
  name: string;
  brand: string;
  imageUrl: string | null;
  category: string;
  detectedSchemaId: string;
  specs: Record<string, string>;
  sourceApi: string;
}

export interface AiProductAnalysis {
  product_name: string;
  category: string;
  suggested_attributes: Record<string, string>;
  description: string;
  suggested_price: number | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Universal product categories shown to merchants in the wizard dropdown.
 * Each entry maps to an internal `schemaId` from data/formSchema.ts which drives
 * the dynamic spec fields shown in the next wizard step.
 *
 * IMPORTANT: this list is the single source of truth — the Gemini prompt in
 * supabase/functions/analyze-product-image/index.ts uses the same labels so
 * AI-detected categories always match a dropdown option exactly.
 */
export const UNIVERSAL_CATEGORIES: Array<{ label: string; schemaId: string }> = [
  { label: 'Electronics',            schemaId: 'electronics' },
  { label: 'Mobiles & Accessories',  schemaId: 'electronics' },
  { label: 'Computers & Laptops',    schemaId: 'electronics' },
  { label: 'Appliances',             schemaId: 'electronics' },
  { label: 'Fashion & Apparel',      schemaId: 'fashion' },
  { label: 'Footwear',               schemaId: 'fashion' },
  { label: 'Beauty & Personal Care', schemaId: 'beauty' },
  { label: 'Health & Wellness',      schemaId: 'health' },
  { label: 'Food & Grocery',         schemaId: 'grocery' },
  { label: 'Home & Kitchen',         schemaId: 'home' },
  { label: 'Furniture',              schemaId: 'furniture' },
  { label: 'Sports & Fitness',       schemaId: 'sports' },
  { label: 'Toys & Games',           schemaId: 'toys' },
  { label: 'Baby & Kids',            schemaId: 'toys' },
  { label: 'Books & Stationery',     schemaId: 'books' },
  { label: 'Automotive',             schemaId: 'automotive' },
  { label: 'Jewellery & Watches',    schemaId: 'jewellery' },
  { label: 'Pet Supplies',           schemaId: 'general' },
];

/** Map any free-form category string to one of our internal form schema IDs. */
export function mapCategoryToSchemaId(category: string): string {
  if (!category) return 'general';
  const lower = category.toLowerCase().trim();
  // Exact label match
  const exact = UNIVERSAL_CATEGORIES.find(c => c.label.toLowerCase() === lower);
  if (exact) return exact.schemaId;
  // Substring match either way
  for (const c of UNIVERSAL_CATEGORIES) {
    const cl = c.label.toLowerCase();
    if (lower.includes(cl) || cl.includes(lower)) return c.schemaId;
  }
  // First-word fallback (e.g. "Mobile Phones" → "Mobiles & Accessories")
  for (const c of UNIVERSAL_CATEGORIES) {
    const firstWord = c.label.toLowerCase().split(/[\s&]+/)[0];
    if (firstWord && lower.includes(firstWord)) return c.schemaId;
  }
  return 'general';
}

/**
 * Map any free-form AI category string to the canonical universal label
 * (so the wizard pre-fills with a label that exists in the dropdown).
 * Returns null if no reasonable match — caller should leave the field blank.
 */
export function mapCategoryToUniversalLabel(category: string): string | null {
  if (!category) return null;
  const lower = category.toLowerCase().trim();
  const exact = UNIVERSAL_CATEGORIES.find(c => c.label.toLowerCase() === lower);
  if (exact) return exact.label;
  for (const c of UNIVERSAL_CATEGORIES) {
    const cl = c.label.toLowerCase();
    if (lower.includes(cl) || cl.includes(lower)) return c.label;
  }
  for (const c of UNIVERSAL_CATEGORIES) {
    const firstWord = c.label.toLowerCase().split(/[\s&]+/)[0];
    if (firstWord && lower.includes(firstWord)) return c.label;
  }
  return null;
}

// Compress image to keep payload small and Gemini latency low.
// Max 1024x1024, JPEG quality 0.85.
async function compressImage(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1024;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mime: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Analyze a product photo with Gemini Vision.
 * Returns parsed product data + a flag for soft AI errors (e.g., "not a product").
 */
export async function analyzeProductImage(
  file: File
): Promise<{ analysis: AiProductAnalysis | null; error: string | null }> {
  try {
    const { base64, mime } = await compressImage(file);

    const { data, error } = await supabase.functions.invoke('analyze-product-image', {
      body: { image_base64: base64, mime_type: mime },
    });

    if (error) {
      console.error('[productLookupService] analyze-product-image EF error:', error);
      // Try to extract the actual error from the edge function response body
      let actualError = 'AI analysis failed. Please try again.';
      try {
        const body = await (error as any).context?.json?.();
        if (body?.error) actualError = body.error;
      } catch {}
      return { analysis: null, error: actualError };
    }

    // Soft AI error — image unclear, not a product, etc.
    if (data?.error) {
      return { analysis: null, error: data.error };
    }

    if (!data?.success) {
      return { analysis: null, error: 'Could not analyze the image. Please try again.' };
    }

    return {
      analysis: {
        product_name: data.product_name || '',
        category: data.category || 'General',
        suggested_attributes: data.suggested_attributes || {},
        description: data.description || '',
        suggested_price: data.suggested_price ?? null,
        confidence: data.confidence || 'medium',
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[productLookupService] analyzeProductImage failed:', err);
    return { analysis: null, error: err.message || 'Unable to analyze image.' };
  }
}

// ── Legacy SerpAPI methods (deprecated — kept for backward compatibility) ─────

async function searchGoogleShopping(
  query: string,
  schemaId: string,
  limit = 6
): Promise<ProductData[]> {
  try {
    const { data } = await supabase.functions.invoke('product-search', {
      body: { query, limit },
    });
    if (!data) return [];
    const results: any[] = data?.shopping_results ?? [];
    return results
      .slice(0, limit)
      .map((r: any) => ({
        name: r.title ?? '',
        brand: r.source ?? '',
        imageUrl: r.thumbnail ?? null,
        category: r.snippet ?? '',
        detectedSchemaId: schemaId,
        specs: { brand: r.source ?? '', price: r.price ?? '' },
        sourceApi: 'Google Shopping',
      }))
      .filter((p: ProductData) => p.name.trim() !== '');
  } catch {
    return [];
  }
}

export async function lookupByBarcode(barcode: string): Promise<ProductData | null> {
  const clean = barcode.replace(/\s/g, '');
  const results = await searchGoogleShopping(clean, 'general', 1);
  return results[0] ?? null;
}

export async function lookupByName(name: string, schemaId: string = 'general'): Promise<ProductData | null> {
  const results = await searchGoogleShopping(name, schemaId, 1);
  return results[0] ?? null;
}

export async function lookupByNameMultiple(name: string, schemaId: string = 'general'): Promise<ProductData[]> {
  return searchGoogleShopping(name, schemaId, 6);
}

export const productLookupService = {
  analyzeProductImage,
  mapCategoryToSchemaId,
  lookupByBarcode,
  lookupByName,
  lookupByNameMultiple,
};
