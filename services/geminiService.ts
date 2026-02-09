import { GoogleGenAI, Type } from "@google/genai";
import { Deal, StructuredLocality } from "../types";

// Removed unused Gemini AI client initialization from this service.
// The `ai` instance is now initialized only where direct Gemini API calls are made,
// such as within `addCampaignService` or within Edge Functions for server-side localization.

const cityCache: Record<string, string[]> = {};
const areaCache: Record<string, string[]> = {};

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
 * Phonetically transliterates a list of locality names into 9 Indian languages.
 */
export const transliterateLocalities = async (stateName: string, localities: string[]): Promise<StructuredLocality[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Transliterate these locality names from ${stateName}, India into 8 other languages (hi, kn, ta, te, ml, bn, mr, gu).
      
      CRITICAL RULES:
      1. Use PHONETIC TRANSLITERATION (matching the sound of the word) in the target script.
      2. Do NOT translate meanings (e.g., 'Indiranagar' should sound like Indiranagar in Hindi, not a translated word for 'Indira' and 'Nagar').
      3. Return an array of objects matching the schema.
      4. Unique ID format: loc_${stateName.toLowerCase().slice(0,3)}_[index].
      
      Localities: ${localities.join(', ')}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              names: {
                type: Type.OBJECT,
                properties: {
                  en: { type: Type.STRING },
                  hi: { type: Type.STRING },
                  kn: { type: Type.STRING },
                  ta: { type: Type.STRING },
                  te: { type: Type.STRING },
                  ml: { type: Type.STRING },
                  bn: { type: Type.STRING },
                  mr: { type: Type.STRING },
                  gu: { type: Type.STRING }
                },
                required: ['en', 'hi', 'kn', 'ta', 'te', 'ml', 'bn', 'mr', 'gu']
              }
            },
            required: ["id", "names"]
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Gemini Transliteration Engine Offline:", e);
    return localities.map((l, i) => ({
      id: `fallback_${i}`,
      names: { en: l, hi: l, kn: l, ta: l, te: l, ml: l, bn: l, mr: l, gu: l }
    }));
  }
};

export const getDealsForLocation = async (location: string, radius: number = 2, coords?: { latitude: number, longitude: number }): Promise<Deal[]> => {
  try {
    const context = coords 
      ? `coordinates [${coords.latitude}, ${coords.longitude}]` 
      : `location name "${location}"`;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 8 realistic, diverse local shopping deals located within a ${radius}km radius of ${context}.
      For each deal, provide a precise "latitude" and "longitude" that is within this radius. 
      The location name should be the street or mall name.
      Include fashion, electronics, dining, and wellness.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              merchantId: { type: Type.STRING },
              shopName: { type: Type.STRING },
              thumbnail: { type: Type.STRING },
              details: { type: Type.STRING },
              dealHeading: { type: Type.STRING },
              offerValue: { type: Type.STRING },
              category: { type: Type.STRING },
              location: { type: Type.STRING },
              latitude: { type: Type.NUMBER },
              longitude: { type: Type.NUMBER },
              discountCode: { type: Type.STRING },
              longDescription: { type: Type.STRING },
              rating: { type: Type.NUMBER },
              endDate: { type: Type.STRING }
            },
            required: ["id", "merchantId", "shopName", "thumbnail", "details", "dealHeading", "offerValue", "category", "location", "latitude", "longitude", "discountCode", "longDescription", "rating", "endDate"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    const parsedDeals = JSON.parse(text);
    return parsedDeals.map((d: any) => ({
      campaign_id: d.id, // Map 'id' from Gemini output to 'campaign_id'
      merchantId: d.merchantId,
      shopName: d.shopName,
      thumbnail: d.thumbnail,
      details: d.details,
      deal_heading: d.dealHeading, // Map 'dealHeading'
      offerValue: d.offerValue,
      category: d.category,
      location: d.location,
      latitude: d.latitude,
      longitude: d.longitude,
      discountCode: d.discountCode,
      longDescription: d.longDescription,
      rating: d.rating,
      end_date: d.endDate // Map 'endDate'
    }));
  } catch (error) {
    const baseLat = coords?.latitude || 12.9716;
    const baseLng = coords?.longitude || 77.5946;
    
    return [
      {
        campaign_id: "offline-1", // Changed from id
        merchantId: "merchant-beta",
        shopName: "Urban Threads",
        thumbnail: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80",
        details: "40% off on any shirt",
        deal_heading: "Urban Threads Fashion Sale", // Changed from dealHeading
        offerValue: "40% OFF",
        category: "Fashion",
        location: location || "Nearby",
        latitude: baseLat + 0.002,
        longitude: baseLng + 0.002,
        discountCode: "SHIRT40",
        longDescription: "Local mesh deal: Premium cotton shirts for the modern urban dweller.",
        rating: 4.5,
        end_date: "2026-12-31" // Changed from endDate
      }
    ];
  }
};

export const searchCitiesInState = async (state: string, query: string): Promise<string[]> => {
  const cacheKey = `${state}:${query.toLowerCase()}`;
  if (cityCache[cacheKey]) return cityCache[cacheKey];

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a list of 5 real, popular cities or towns in ${state}, India that contain or match the search: "${query}". Return as a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    const results = JSON.parse(response.text || '[]');
    cityCache[cacheKey] = results;
    return results;
  } catch (error: any) {
    const fallbacks = FALLBACK_CITIES[state] || [];
    return fallbacks.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  }
};

export const searchAreasInCity = async (state: string, city: string, query: string): Promise<string[]> => {
  const cacheKey = `${state}:${city}:${query.toLowerCase()}`;
  if (areaCache[cacheKey]) return areaCache[cacheKey];

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a list of 5 real neighborhoods, localities, or major areas in ${city}, ${state}, India that contain or match the search: "${query}". Return as a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    const results = JSON.parse(response.text || '[]');
    areaCache[cacheKey] = results;
    return results;
  } catch (error: any) {
    return [];
  }
};