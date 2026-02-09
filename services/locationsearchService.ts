import { supabase } from "./supabaseClient";
import { Geolocation } from "@capacitor/geolocation";
import { DBState, DBCity, DBLocality, Locale, LocalizedNames } from "../types";

// Removed unused Gemini AI client initialization from this service.
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cityCache: Record<string, string[]> = {};
const areaCache: Record<string, string[]> = {};

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
    const { data, error } = await supabase.functions.invoke('location/search-localities', { // Updated EF name
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
    // This calls the Edge Function at supabase/functions/location/lookup-pincode/index.ts
    const { data, error } = await supabase.functions.invoke('location/lookup-pincode', {
      body: { pincode },
    });
    if (error) {
      console.error("Pincode lookup failed via Edge Function:", error);
      throw error; // Propagate error
    }
    return data as PincodeLookupResponse;
  },

  /**
   * Performs reverse geocoding using Google Maps API to get city and state from a pincode.
   * This runs entirely client-side.
   * @param pincode The 6-digit Indian pincode.
   * @returns An object containing `city` and `state` names, or `null` if not found/error.
   */
  reverseGeocodePincode: async (pincode: string): Promise<{ city: string; state: string } | null> => {
    const gWindow = window as any;
    if (!gWindow.google || !gWindow.google.maps || !gWindow.google.maps.Geocoder) {
      console.error("Google Maps SDK or Geocoder not loaded.");
      return null;
    }

    return new Promise((resolve) => {
      const geocoder = new gWindow.google.maps.Geocoder();
      // Appending ', India' helps restrict results to India, improving accuracy.
      geocoder.geocode({ address: pincode + ', India' }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          let city = '';
          let state = '';

          for (const component of results[0].address_components) {
            if (component.types.includes('locality')) {
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
          }
          if (city && state) {
            resolve({ city, state });
          } else {
            console.warn(`Pincode ${pincode} found, but city/state components missing in Google Maps response.`, results[0]);
            resolve(null);
          }
        } else {
          console.error(`Google Geocoding failed for pincode ${pincode} with status:`, status);
          resolve(null);
        }
      });
    });
  },

  /**
   * Performs reverse geocoding using Google Maps API to get city and state from coordinates.
   * This runs entirely client-side.
   * @param latitude The latitude.
   * @param longitude The longitude.
   * @returns An object containing `city` and `state` names, or `null` if not found/error.
   */
  reverseGeocodeCoordinates: async (latitude: number, longitude: number): Promise<{ city: string; state: string } | null> => {
    const gWindow = window as any;
    if (!gWindow.google || !gWindow.google.maps || !gWindow.google.maps.Geocoder) {
      console.error("Google Maps SDK or Geocoder not loaded for reverseGeocodeCoordinates.");
      return null;
    }

    return new Promise((resolve) => {
      const geocoder = new gWindow.google.maps.Geocoder();
      const latLng = new gWindow.google.maps.LatLng(latitude, longitude);
      
      geocoder.geocode({ 'location': latLng }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          let city = '';
          let state = '';

          for (const component of results[0].address_components) {
            if (component.types.includes('locality')) {
              city = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
          }
          if (city && state) {
            resolve({ city, state });
          } else {
            console.warn(`Coords [${latitude}, ${longitude}] found, but city/state components missing in Google Maps response.`, results[0]);
            resolve(null);
          }
        } else {
          console.error(`Google Geocoding failed for coords [${latitude}, ${longitude}] with status:`, status);
          resolve(null); 
        }
      });
    });
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

  // Remains client-side (Google Maps API)
  geocodeAddressWithAI: async (address: string): Promise<{ latitude: number, longitude: number } | null> => {
    const gWindow = window as any;
    if (!gWindow.google || !gWindow.google.maps) {
      console.error("Google Maps SDK not loaded");
      return null;
    }
    
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.error("Geocoding timed out for address:", address);
        resolve(null);
      }, 5000); // 5 seconds timeout

      try {
        const geocoder = new gWindow.google.maps.Geocoder();
        geocoder.geocode({ address }, (results: any, status: any) => {
          clearTimeout(timer);
          if (status === 'OK' && results && results[0]) {
            const { lat, lng } = results[0].geometry.location;
            resolve({ latitude: lat(), longitude: lng() });
          } else {
            console.error("Google Geocoding failed with status:", status);
            resolve(null);
          }
        });
      } catch (e) {
        clearTimeout(timer);
        console.error("Geocoding exception:", e);
        resolve(null);
      }
    });
  },
};