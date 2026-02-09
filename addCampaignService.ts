
import { supabase } from "./supabaseClient";
// @google/genai Coding Guideline: Always use `import {GoogleGenAI, Type} from "@google/genai";`
import { GoogleGenAI, Type } from "@google/genai";
import { Deal, Locale } from "../types";

// @google/genai Coding Guideline: Always use `const ai = new GoogleGenAI({apiKey: process.env.API_KEY});`
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

export const addCampaignService = {
  // This remains client-side as it directly calls the Gemini API, not Supabase DB.
  translateCampaignData: async (title: string, offer: string, desc: string, shopName: string): Promise<{ heading: any, offer: any, description: any, shop_name: any }> => {
    try {
      const languageProperties = {
        en: { type: Type.STRING },
        hi: { type: Type.STRING },
        kn: { type: Type.STRING },
        ta: { type: Type.STRING },
        te: { type: Type.STRING },
        ml: { type: Type.STRING },
        bn: { type: Type.STRING },
        mr: { type: Type.STRING },
        gu: { type: Type.STRING }
      };

      // @google/genai Coding Guideline: Use 'gemini-3-flash-preview' for basic text tasks.
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Act as a professional retail localizer for India. Translate these 4 specific fields into 8 Indian languages (hi, kn, ta, te, ml, bn, mr, gu).
        Field 1 (Heading): ${title}
        Field 2 (Offer): ${offer}
        Field 3 (Long Description): ${desc}
        Field 4 (Shop Name): ${shopName}
        Return strict JSON object with keys "heading", "offer", "description", "shop_name". Each key maps language codes to pure translated or transliterated strings. For Shop Name, use phonetic transliteration so it sounds correct in regional scripts.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              heading: { type: Type.OBJECT, properties: languageProperties },
              offer: { type: Type.OBJECT, properties: languageProperties },
              description: { type: Type.OBJECT, properties: languageProperties },
              shop_name: { type: Type.OBJECT, properties: languageProperties }
            },
            required: ["heading", "offer", "description", "shop_name"]
          }
        }
      });
      // @google/genai Coding Guideline: Use `response.text` to extract string output.
      return JSON.parse(response.text || '{}');
    } catch (e) {
      console.error("Gemini Translation failed", e);
      return { 
        heading: { en: title }, 
        offer: { en: offer }, 
        description: { en: desc }, 
        shop_name: { en: shopName } 
      };
    }
  },

  // Calls Edge Function
  repairCampaignTranslations: async (merchantId: string) => {
    const { data, error } = await supabase.functions.invoke('repair-translations', {
      body: { merchantId: merchantId as string },
    });
    if (error) throw error;
    return data;
  },

  // Calls Edge Function to get ALL deals (used by consumers with geo/city filters)
  getDeals: async (): Promise<Deal[]> => {
    const { data, error } = await supabase.functions.invoke('get-all', {
      method: 'GET',
    });
    if (error) throw error;
    return data as Deal[];
  },
  
  // Calls Edge Function to get deals specific to a merchant
  getMerchantDeals: async (merchantId: string): Promise<Deal[]> => {
    console.log(`[addCampaignService] Invoking 'get-by-merchant' for merchant ID: ${merchantId}`);
    const { data, error } = await supabase.functions.invoke('get-by-merchant', {
      body: { merchantId },
    });
    if (error) throw error;
    return data as Deal[];
  },

  // Calls Edge Function
  getStoreCategories: async (): Promise<string[]> => {
    const { data, error } = await supabase.functions.invoke('get-store-categories', {
      method: 'GET',
    });
    if (error) throw error;
    return data as string[];
  },

  // Calls Edge Function (Storage via Edge Function)
  uploadDealImage: async (mId: string, file: File): Promise<{ publicUrl: string, imageName: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('merchantId', mId as string); // Pass merchantId for authorization in Edge Function

    const { data, error } = await supabase.functions.invoke('upload-deal-image', { // Changed to 'upload-deal-image'
      body: formData,
      // CRUCIAL: Do NOT manually set 'Content-Type': 'multipart/form-data'. 
      // The browser automatically sets this with the correct boundary when the body is a FormData object.
    });
    if (error) throw error;
    return data as { publicUrl: string, imageName: string };
  },

  // Calls Edge Function
  createCampaign: async (d: any) => {
    const { data, error } = await supabase.functions.invoke('create-campaign', { // This was the line that needed correction
      body: d,
    });
    if (error) throw error;
    return data;
  },

  // Calls Edge Function
  updateCampaign: async (id: string, d: any) => {
    // Merge ID into the body for the Edge Function
    const payload = { campaign_id: id as string, ...d };
    const { data, error } = await supabase.functions.invoke('update', {
      body: payload,
    });
    if (error) throw error;
    return data;
  },

  // Calls Edge Function
  verifyClaimScan: async (claim: any, mId: string): Promise<{ success: boolean, message?: string, error?: string }> => {
    const { data, error } = await supabase.functions.invoke('verify-scan', { // Changed to 'verify-scan'
      body: { claimData: claim, merchantId: mId as string },
    });
    if (error) throw error;
    return data as { success: boolean, message?: string, error?: string };
  },

  // Calls Edge Function
  getMerchantImages: async (mId: string) => {
    const { data, error } = await supabase.functions.invoke('get-merchant-images', {
      body: { merchantId: mId as string },
    });
    if (error) throw error;
    // Filter unique by URL or name to prevent duplicates
    const uniqueImages = Array.from(new Set((data as {url: string, name?: string}[] || []).map(i => i.url)))
      .map(url => (data as {url: string, name?: string}[]).find(i => i.url === url)!);
    return uniqueImages;
  },
};