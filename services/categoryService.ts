/**
 * categoryService.ts
 * Fetches store categories from Supabase edge function
 */

import { supabase } from './supabaseClient';

export interface Category {
  name: string;
  label: string; // For display (if different from name)
}

/**
 * Fetches active store categories from the database via edge function.
 * Returns an array of category name strings.
 */
export async function fetchStoreCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke('get-store-categories', {
      method: 'GET',
    });

    if (error) {
      console.error('[categoryService] Error fetching categories:', error);
      return getFallbackCategories();
    }

    if (!data || !Array.isArray(data)) {
      console.warn('[categoryService] Invalid response format:', data);
      return getFallbackCategories();
    }

    console.log(`[categoryService] Fetched ${data.length} categories from database`);
    return data as string[];
  } catch (err: any) {
    console.error('[categoryService] Exception fetching categories:', err.message);
    return getFallbackCategories();
  }
}

/**
 * Fallback categories if database fetch fails.
 * Matches the existing formSchema categories.
 */
function getFallbackCategories(): string[] {
  return [
    'Grocery',
    'Restaurant',
    'Electronics',
    'Fashion',
    'Beauty',
    'Health',
    'Books',
    'Home',
    'Automotive',
    'Tires',
    'Sports',
    'Jewellery',
    'Toys',
    'Furniture',
    'General',
  ];
}
