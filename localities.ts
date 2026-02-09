
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
    
    // Fix: Restructured the switch statement to use a common return path with normalization, 
    // resolving type errors for Tamil Nadu, Kerala, and other state modules that return string arrays.
    switch (stateName) {
      case "Karnataka":
        rawData = (await import('./karnataka_data.ts')).default;
        break;
      
      case "Tamil Nadu":
        rawData = (await import('./tamilnadu_data.ts')).default;
        break;

      case "Kerala":
        rawData = (await import('./kerala_data.ts')).default;
        break;

      case "Maharashtra":
        rawData = (await import('./maharashtra_data.ts')).default;
        break;

      case "Andhra Pradesh":
        rawData = (await import('./andhra_pradesh_data.ts')).default;
        break;

      case "Assam":
        rawData = (await import('./assam_data.ts')).default;
        break;

      case "Bihar":
        rawData = (await import('./bihar_data.ts')).default;
        break;

      case "Chhattisgarh":
        rawData = (await import('./chhattisgarh_data.ts')).default;
        break;

      case "Delhi":
        rawData = (await import('./delhi_data.ts')).default;
        break;

      case "Goa":
        rawData = (await import('./goa_data.ts')).default;
        break;

      case "Gujarat":
        rawData = (await import('./gujarat_data.ts')).default;
        break;

      case "Haryana":
        rawData = (await import('./haryana_data.ts')).default;
        break;

      case "Himachal Pradesh":
        rawData = (await import('./himachal_pradesh_data.ts')).default;
        break;

      case "Jharkhand":
        rawData = (await import('./jharkhand_data.ts')).default;
        break;

      case "Madhya Pradesh":
        rawData = (await import('./madhya_pradesh_data.ts')).default;
        break;

      case "Odisha":
        rawData = (await import('./odisha_data.ts')).default;
        break;

      case "Punjab":
        rawData = (await import('./punjab_data.ts')).default;
        break;

      case "Rajasthan":
        rawData = (await import('./rajasthan_data.ts')).default;
        break;

      case "Telangana":
        rawData = (await import('./telangana_data.ts')).default;
        break;

      case "Uttar Pradesh":
        rawData = (await import('./uttar_pradesh_data.ts')).default;
        break;

      case "West Bengal":
        rawData = (await import('./west_bengal_data.ts')).default;
        break;

      case "Uttarakhand":
        rawData = (await import('./uttarakhand_data.ts')).default;
        break;

      default: // Add a default case for robustness
        console.warn(`[localities.ts] No locality data found for state: ${stateName}.`);
        rawData = null; // Ensure rawData is explicitly set to null if no match
        break;
    }
    
    return normalizeLocalities(rawData, stateName);
  } catch (err) {
    console.error("Error fetching state localities:", err);
    return null; // Return null on error, as per the declared type
  }
};
