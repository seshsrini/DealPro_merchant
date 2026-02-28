import { supabase } from "./supabaseClient";
import { Geolocation } from "@capacitor/geolocation";
import { DBState, DBCity, DBLocality, Locale, LocalizedNames } from "../types";

// Removed unused Gemini AI client initialization from this service.
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cityCache: Record<string, string[]> = {};
const areaCache: Record<string, string[]> = {};

// Nominatim headers kept as fallback only — primary geocoding now routes through Edge Functions
const NOMINATIM_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'DealProMerchant/1.0'
};

// Fallback cities, might be removed if dbService.getStates/getCities are robust
const FALLBACK_CITIES: Record<string, string[]> = {
  "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane"],
  "Karnataka": ["Bangalore", "Mysore", "Hubli", "Mangalore", "Belgaum"],
  "Delhi": ["New Delhi", "Dwarka", "Rohini", "Vasant Kunj", "Saket"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem", "Trichy"],
  "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Khammam", "Karimnagar"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Siliguri", "Asansol"],
  "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"],
};

/**
 * Interface representing the structured response from the pincode lookup Edge Function.
 */
export interface PincodeLookupResponse {
  locality: DBLocality;
  city: DBCity;
  stateId: number;
}

export const locationsearchService = {
  // Calls Edge Function
  getStates: async (lang: Locale): Promise<DBState[]> => {
    // It's assumed that the supabase.functions.invoke method implicitly handles the JWT in headers
    // after the session is set by updateSupabaseSession.
    const { data, error } = await supabase.functions.invoke('get-states', { // Updated EF name
      body: { lang },
    });
    if (error) {
      console.error("Registry Error: Failed to fetch states via Edge Function", error);
      throw error; // Propagate error
    }
    return data as DBState[];
  },

  // Calls Edge Function
  getCities: async (stateId: number, lang: Locale): Promise<DBCity[]> => {
    // It's assumed that the supabase.functions.invoke method implicitly handles the JWT in headers
    const { data, error } = await supabase.functions.invoke('get-cities', { // Updated EF name
      body: { stateId, lang },
    });
    if (error) {
      console.error(`Registry Error: Failed to fetch cities for state ${stateId} via Edge Function`, error);
      throw error; // Propagate error
    }
    return data as DBCity[];
  },

  // Calls Edge Function
  getLocalities: async (cityId: number, lang: Locale): Promise<DBLocality[]> => {
    // It's assumed that the supabase.functions.invoke method implicitly handles the JWT in headers
    const { data, error } = await supabase.functions.invoke('get-localities', { // Updated EF name
      body: { cityId, lang },
    });
    if (error) {
      console.error(`Registry Error: Failed to fetch localities for city ${cityId} via Edge Function`, error);
      throw error; // Propagate error
    }
    return data as DBLocality[];
  },

  // Calls Edge Function
  searchLocalities: async (query: string, lang: Locale): Promise<DBLocality[]> => {
    // It's assumed that the supabase.functions.invoke method implicitly handles the JWT in headers
    const { data, error } = await supabase.functions.invoke('search-localities', { // Corrected EF name
      body: { query, lang },
    });
    if (error) {
      console.error("Locality Search Failed via Edge Function:", error);
      throw error; // Propagate error
    }
    return data as DBLocality[];
  },

  /**
   * Performs pincode lookup via an Edge Function to get structured locality, city, and state information.
   * This is used for populating dropdowns and map coordinates.
   */
  lookupPincode: async (pincode: string): Promise<PincodeLookupResponse | null> => {
    // This calls the Edge Function at supabase/functions/lookup-pincode/index.ts
    const { data, error } = await supabase.functions.invoke('lookup-pincode', {
      body: { pincode },
    });
    if (error) {
      console.error("Pincode lookup failed via Edge Function:", error);
      throw error; // Propagate error
    }
    return data as PincodeLookupResponse;
  },

  /**
   * Reverse geocodes a pincode to get locality, city and state.
   * Routes through server-side Edge Function with DB cache + Nominatim fallback.
   * Client-side Nominatim used only as emergency fallback.
   */
  reverseGeocodePincode: async (pincode: string): Promise<{ locality: string; city: string; state: string } | null> => {
    // Primary: use reverse-geocode Edge Function via pincode geocoding
    // The lookup-pincode EF already returns structured city/state data
    try {
      const { data, error } = await supabase.functions.invoke('lookup-pincode', {
        body: { pincode },
      });
      if (!error && data?.locality && data?.city) {
        const locality = data.locality.names?.en || '';
        const city = data.city.names?.en || '';
        // Resolve state name from stateId
        const stateMap: Record<number, string> = {
          1: 'Andhra Pradesh', 2: 'Arunachal Pradesh', 3: 'Assam', 4: 'Bihar',
          5: 'Chhattisgarh', 6: 'Goa', 7: 'Gujarat', 8: 'Haryana',
          9: 'Himachal Pradesh', 10: 'Jharkhand', 11: 'Karnataka', 12: 'Kerala',
          13: 'Madhya Pradesh', 14: 'Maharashtra', 15: 'Manipur', 16: 'Meghalaya',
          17: 'Mizoram', 18: 'Nagaland', 19: 'Odisha', 20: 'Punjab',
          21: 'Rajasthan', 22: 'Sikkim', 23: 'Tamil Nadu', 24: 'Telangana',
          25: 'Tripura', 26: 'Uttar Pradesh', 27: 'Uttarakhand', 28: 'West Bengal',
          29: 'Delhi',
        };
        const state = stateMap[data.stateId] || '';
        if (city && locality) return { locality, city, state };
      }
    } catch (e) {
      console.warn('[reverseGeocodePincode] Edge Function failed, trying Nominatim fallback:', e);
    }

    // Fallback: direct Nominatim call
    try {
      const url = `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&addressdetails=1&limit=1&accept-language=en`;
      const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(5000) });
      const results = await res.json();
      if (results?.[0]?.address) {
        const addr = results[0].address;
        const locality = addr.suburb || addr.neighbourhood || addr.village || addr.hamlet || '';
        const city = addr.city || addr.town || addr.county || '';
        const state = addr.state || '';
        if (city && state) return { locality, city, state };
      }
    } catch (e) {
      console.error(`[reverseGeocodePincode] Nominatim fallback also failed for ${pincode}:`, e);
    }
    return null;
  },

  /**
   * Reverse geocodes coordinates to get locality, city and state.
   * Routes through server-side Edge Function with DB cache + Nominatim fallback.
   */
  reverseGeocodeCoordinates: async (latitude: number, longitude: number): Promise<{ locality: string; city: string; state: string } | null> => {
    // Primary: use reverse-geocode Edge Function
    try {
      const { data, error } = await supabase.functions.invoke('reverse-geocode', {
        body: { latitude, longitude },
      });
      if (!error && data?.city) {
        return { locality: data.locality || '', city: data.city, state: data.state || '' };
      }
    } catch (e) {
      console.warn('[reverseGeocodeCoordinates] Edge Function failed, trying Nominatim fallback:', e);
    }

    // Fallback: direct Nominatim call
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=en`;
      const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (data?.address) {
        const locality = data.address.suburb || data.address.neighbourhood || data.address.village || data.address.hamlet || '';
        const city = data.address.city || data.address.town || data.address.county || '';
        const state = data.address.state || '';
        if (city && state) return { locality, city, state };
      }
    } catch (e) {
      console.error(`[reverseGeocodeCoordinates] Nominatim fallback also failed:`, e);
    }
    return null;
  },

  // Remains client-side (Capacitor Geolocation)
  getCurrentLocation: async (): Promise<{ latitude: number, longitude: number } | null> => {
    try {
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') return null;
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
    } catch (error) {
      console.error("Hardware GPS Error:", error);
      return null;
    }
  },

  /**
   * Geocode a pincode to coordinates.
   * Routes through server-side Edge Function with DB cache + Nominatim fallback.
   */
  geocodePincode: async (pincode: string): Promise<{ latitude: number, longitude: number } | null> => {
    // Primary: use geocode-pincode Edge Function (checks DB first, then Nominatim, caches result)
    try {
      const { data, error } = await supabase.functions.invoke('geocode-pincode', {
        body: { pincode },
      });
      if (!error && data?.latitude && data?.longitude) {
        console.log(`[geocodePincode] EF resolved ${pincode} → ${data.latitude}, ${data.longitude} (source: ${data.source})`);
        return { latitude: data.latitude, longitude: data.longitude };
      }
    } catch (e) {
      console.warn('[geocodePincode] Edge Function failed, trying Nominatim fallback:', e);
    }

    // Fallback: direct Nominatim call
    try {
      const url = `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1&accept-language=en`;
      const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(5000) });
      const results = await res.json();
      if (results?.[0]) {
        return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
      }
    } catch (e) {
      console.error(`[geocodePincode] Nominatim fallback also failed for ${pincode}:`, e);
    }
    return null;
  },

  /**
   * Forward geocode an address string to coordinates.
   * Routes through server-side Edge Function with cache + Nominatim fallback.
   */
  geocodeAddressWithAI: async (address: string): Promise<{ latitude: number, longitude: number } | null> => {
    // Primary: use geocode-address Edge Function (checks cache first, then Nominatim, caches result)
    try {
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { address },
      });
      if (!error && data?.latitude && data?.longitude) {
        console.log(`[geocodeAddress] EF resolved "${address}" → ${data.latitude}, ${data.longitude} (source: ${data.source})`);
        return { latitude: data.latitude, longitude: data.longitude };
      }
    } catch (e) {
      console.warn('[geocodeAddress] Edge Function failed, trying Nominatim fallback:', e);
    }

    // Fallback: direct Nominatim call
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&accept-language=en`;
      const res = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(5000) });
      const results = await res.json();
      if (results?.[0]) {
        return { latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) };
      }
    } catch (e) {
      console.error(`[geocodeAddress] Nominatim fallback also failed for "${address}":`, e);
    }
    return null;
  },
};