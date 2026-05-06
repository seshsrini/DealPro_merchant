
import { StructuredLocality } from './types';

// Fix: Added normalization helper to convert Record<string, string[]> (simple name lists) 
// into Record<string, StructuredLocality[]> expected by the application state.
const normalizeLocalities = (data: any, stateName: string): Record<string, StructuredLocality[]> => {
  if (!data) return {};
  const normalized: Record<string, StructuredLocality[]> = {};
  
  Object.keys(data).forEach(city => {
    normalized[city] = data[city].map((item: string | StructuredLocality, index: number) => {
      if (typeof item === 'string') {
        // Fallback for simple string lists found in most state modules
        return {
          id: `loc_${stateName.toLowerCase().slice(0,3)}_${city.toLowerCase().slice(0,3)}_${index}`,
          names: {
            en: item,
            hi: item,
            kn: item,
            ta: item,
            te: item,
            ml: item,
            bn: item,
            mr: item,
            gu: item
          }
        };
      }
      return item;
    });
  });
  
  return normalized;
};

/**
 * Dynamically imports locality data for a specific state.
 * Returns a record where keys are city names and values are arrays of structured localities.
 */
export const fetchStateLocalities = async (stateName: string): Promise<Record<string, StructuredLocality[]> | null> => {
  try {
    let rawData: any = null;
    
    // State name → data file slug. Some files don't exist yet (only bihar/odisha
    // were generated) — load attempts for missing files fall through to the
    // catch below and return null. Using a templated dynamic import (rather than
    // a literal string per case) keeps tsc from trying to statically resolve
    // every file at type-check time.
    const STATE_FILE_MAP: Record<string, string> = {
      "Karnataka":        "karnataka_data",
      "Tamil Nadu":       "tamilnadu_data",
      "Kerala":           "kerala_data",
      "Maharashtra":      "maharashtra_data",
      "Andhra Pradesh":   "andhra_pradesh_data",
      "Assam":            "assam_data",
      "Bihar":            "bihar_data",
      "Chhattisgarh":     "chhattisgarh_data",
      "Delhi":            "delhi_data",
      "Goa":              "goa_data",
      "Gujarat":          "gujarat_data",
      "Haryana":          "haryana_data",
      "Himachal Pradesh": "himachal_pradesh_data",
      "Jharkhand":        "jharkhand_data",
      "Madhya Pradesh":   "madhya_pradesh_data",
      "Odisha":           "odisha_data",
      "Punjab":           "punjab_data",
      "Rajasthan":        "rajasthan_data",
      "Telangana":        "telangana_data",
      "Uttar Pradesh":    "uttar_pradesh_data",
      "West Bengal":      "west_bengal_data",
      "Uttarakhand":      "uttarakhand_data",
    };
    const fileSlug = STATE_FILE_MAP[stateName];
    if (!fileSlug) {
      console.warn(`[localities.ts] No locality data mapping for state: ${stateName}.`);
      return {};
    }
    try {
      rawData = (await import(/* @vite-ignore */ `./${fileSlug}.ts`)).default;
    } catch {
      console.warn(`[localities.ts] Locality data not bundled for state: ${stateName}.`);
      rawData = null;
    }
    
    return normalizeLocalities(rawData, stateName);
  } catch (err) {
    console.error("Error fetching state localities:", err);
    return null; // Return null on error, as per the declared type
  }
};
