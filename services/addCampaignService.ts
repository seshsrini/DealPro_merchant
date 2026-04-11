
import { supabase } from "./supabaseClient";
// @google/genai Coding Guideline: Always use `import {GoogleGenAI, Type} from "@google/genai";`
import { GoogleGenAI, Type } from "@google/genai";
import { Deal } from "../types";

// @google/genai Coding Guideline: Always use `const ai = new GoogleGenAI({apiKey: process.env.API_KEY});`
const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY });

export const addCampaignService = {
  // AI-powered image moderation using Gemini multimodal — checks for inappropriate visual content
  moderateImage: async (imageFile: File): Promise<{ flagged: boolean; reason: string }> => {
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data:image/...;base64, prefix
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: imageFile.type || 'image/jpeg',
                  data: base64,
                },
              },
              {
                text: `You are a strict image content moderator for a family-friendly commercial deals and coupons platform in India.
Analyze this image and determine if it contains ANY inappropriate content including:
- Pornography, nudity, or sexually explicit/suggestive content
- Hate symbols, Nazi imagery, or extremist iconography
- Graphic violence, gore, or disturbing imagery
- Drug use or illegal substance promotion
- Offensive gestures or slurs in any language
- Content clearly not suitable for a commercial retail platform

If the image is a normal product photo, store image, food photo, promotional graphic, or any standard commercial content, do NOT flag it.
Be strict about inappropriate content but reasonable about normal commercial imagery.`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flagged: { type: Type.BOOLEAN },
              reason: { type: Type.STRING },
            },
            required: ['flagged', 'reason'],
          },
        },
      });
      return JSON.parse(response.text || '{"flagged":false,"reason":""}');
    } catch (e) {
      console.error('[moderateImage] AI image moderation failed:', e);
      // Don't block on AI failure
      return { flagged: false, reason: '' };
    }
  },

  // AI-powered content moderation using Gemini — catches context-based inappropriate content
  moderateContent: async (title: string, offer: string, description: string): Promise<{ flagged: boolean; reason: string }> => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a strict content moderator for a commercial deals and coupons platform in India.
Analyze ONLY the provided non-empty fields below for inappropriate content including:
- Profanity or vulgar language (in any language including Hindi, Kannada, Tamil, Telugu)
- Sexual content, innuendo, or suggestive language (e.g. "sleep with you", "come to bed", etc.)
- Hate speech, discrimination, or casteist slurs
- Harassment, threats, or violent language
- Personal messages disguised as deals

${title ? `Deal Title: "${title}"` : ''}
${offer ? `Offer Value: "${offer}"` : ''}
${description ? `Deal Description: "${description}"` : ''}

IMPORTANT: Only check the fields that have content above. Empty or missing fields are being filled in separately and should NOT be flagged.
Be strict about inappropriate language. If the provided content is a normal commercial deal/offer text, do NOT flag it.
Only flag if the actual text content is inappropriate for a family-friendly commercial platform.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flagged: { type: Type.BOOLEAN },
              reason: { type: Type.STRING },
            },
            required: ["flagged", "reason"]
          }
        }
      });
      return JSON.parse(response.text || '{"flagged":false,"reason":""}');
    } catch (e) {
      console.error("[moderateContent] AI moderation check failed:", e);
      // Don't block on AI failure — let the server-side keyword check handle it
      return { flagged: false, reason: '' };
    }
  },

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
    if (error) throw new Error('Unable to process campaign. Please try again.');
    return data;
  },

  // Calls Edge Function to get ALL deals (used by consumers with geo/city filters)
  getDeals: async (): Promise<Deal[]> => {
    const { data, error } = await supabase.functions.invoke('get-all', {
      method: 'POST', // Changed from GET to POST
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    return data as Deal[];
  },
  
  // Calls Edge Function to get deals specific to a merchant
  getMerchantDeals: async (merchantId: string): Promise<Deal[]> => {
    console.log(`[addCampaignService] Invoking 'get-by-merchant' for merchant ID: ${merchantId}`);
    const { data, error } = await supabase.functions.invoke('get-by-merchant', {
      body: { merchantId },
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    return data as Deal[];
  },

  // NEW: Calls Edge Function to get deals by status (e.g., for admin review)
  getDealsByStatus: async (status: string): Promise<Deal[]> => {
    console.log(`[addCampaignService] Invoking 'get-by-status' for status: ${status}`);
    const { data, error } = await supabase.functions.invoke('get-by-status', {
      body: { status },
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    return data as Deal[];
  },

  // Calls Edge Function
  getStoreCategories: async (): Promise<string[]> => {
    const { data, error } = await supabase.functions.invoke('get-store-categories', {
      method: 'GET',
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    return data as string[];
  },

  // Direct client-to-Cloudinary upload (fast — no Edge Function proxy for the file)
  uploadDealImage: async (mId: string, file: File): Promise<{ publicUrl: string, imageName: string }> => {
    // Step 1 — get signature from edge function (lightweight JSON call)
    const { data: signData, error: signErr } = await supabase.functions.invoke('cloudinary-sign', {
      body: { folder: 'dealpro-campaigns' },
    });
    if (signErr) throw new Error('Image upload preparation failed. Please try again.');

    const { signature, timestamp, api_key, cloud_name, folder } = signData;

    // Step 2 — upload directly to Cloudinary (no EF proxy)
    const form = new FormData();
    form.append('file', file);
    form.append('signature', signature);
    form.append('timestamp', String(timestamp));
    form.append('api_key', api_key);
    form.append('folder', folder);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
      { method: 'POST', body: form, signal: AbortSignal.timeout(30000) }
    );
    if (!res.ok) throw new Error('Image upload failed. Please try again.');

    const json = await res.json();
    if (!json.secure_url) throw new Error('Image upload succeeded but no URL returned');
    const imageName = `${mId}/${Date.now()}_${file.name}`;
    return { publicUrl: json.secure_url as string, imageName };
  },

  // Direct client-to-Cloudinary video upload
  uploadDealVideo: async (mId: string, file: File): Promise<{ publicUrl: string }> => {
    const { data: signData, error: signErr } = await supabase.functions.invoke('cloudinary-sign', {
      body: { folder: 'dealpro-campaigns-video' },
    });
    if (signErr) throw new Error('Video upload preparation failed. Please try again.');

    const { signature, timestamp, api_key, cloud_name, folder } = signData;

    const form = new FormData();
    form.append('file', file);
    form.append('signature', signature);
    form.append('timestamp', String(timestamp));
    form.append('api_key', api_key);
    form.append('folder', folder);
    form.append('resource_type', 'video');

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`,
      { method: 'POST', body: form, signal: AbortSignal.timeout(120000) }
    );
    if (!res.ok) throw new Error('Video upload failed. Please try again.');

    const json = await res.json();
    if (!json.secure_url) throw new Error('Video upload succeeded but no URL returned');
    return { publicUrl: json.secure_url as string };
  },

  // Calls Edge Function
  createCampaign: async (d: any) => {
    let data, error;
    try {
      const result = await supabase.functions.invoke('create-campaign', {
        body: d,
      });
      data = result.data;
      error = result.error;
    } catch (tokenErr: any) {
      console.error('[addCampaignService] Session error:', tokenErr?.message);
      throw new Error(tokenErr?.message?.includes('Session expired') || tokenErr?.message?.includes('log in')
        ? 'Your session has expired. Please close and reopen the app.'
        : 'Unable to process campaign. Please try again.');
    }
    if (error) {
      try {
        const errorBody = await error.context?.json?.();
        if (errorBody?.error) {
          if (errorBody.error.includes('Unauthorized') || errorBody.error.includes('expired')) {
            throw new Error('Your session has expired. Please close and reopen the app.');
          }
          throw new Error(errorBody.error);
        }
      } catch (parseErr: any) {
        if (parseErr.message && parseErr.message !== error.message) throw parseErr;
      }
      throw new Error('Unable to process campaign. Please try again.');
    }
    return data;
  },

  // Calls Edge Function for Merchant's OWN campaign updates
  updateCampaign: async (id: string, d: any) => {
    const payload = { campaign_id: id as string, ...d };
    const { data, error } = await supabase.functions.invoke('campaign-update', {
      body: payload,
    });
    if (error) {
      try {
        const errorBody = await error.context?.json?.();
        if (errorBody?.error) throw new Error(errorBody.error);
      } catch (parseErr: any) {
        if (parseErr.message && parseErr.message !== error.message) throw parseErr;
      }
      throw new Error('Unable to process campaign. Please try again.');
    }
    return data;
  },

  // NEW: Calls Edge Function for Deal Admin's campaign updates
  adminUpdateCampaign: async (id: string, d: any) => {
    console.log(`[addCampaignService] Invoking 'admin-update-campaign' for campaign ID: ${id}`);
    const payload = { campaign_id: id as string, ...d };
    const { data, error } = await supabase.functions.invoke('admin-update-campaign', {
      body: payload,
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    return data;
  },

  // NEW: Calls Edge Function 'approve-campaign'
  approveCampaign: async (campaignId: string, merchantId: string) => {
    const payload = { campaign_id: campaignId, merchant_id: merchantId, status: 'active' };
    const { data, error } = await supabase.functions.invoke('approve-campaign', {
      body: payload,
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    return data;
  },

  // NEW: Calls Edge Function 'get-one'
  getCampaignDetails: async (campaignId: string): Promise<Deal> => {
    console.log(`[addCampaignService] Invoking 'get-one' for campaign ID: ${campaignId}`);
    const { data, error } = await supabase.functions.invoke('get-one', {
      body: { campaignId },
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    return data as Deal;
  },

  // Calls Edge Function
  verifyClaimScan: async (claim: any, mId: string): Promise<{ success: boolean, message?: string, error?: string }> => {
    const { data, error } = await supabase.functions.invoke('verify-scan', { // Changed to 'verify-scan'
      body: { claimData: claim, merchantId: mId as string },
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    return data as { success: boolean, message?: string, error?: string };
  },

  // Calls Edge Function
  getMerchantImages: async (mId: string) => {
    const { data, error } = await supabase.functions.invoke('get-merchant-images', {
      body: { merchantId: mId as string },
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    const uniqueImages = Array.from(new Set((data as {url: string, name?: string}[] || []).map(i => i.url)))
      .map(url => (data as {url: string, name?: string}[]).find(i => i.url === url)!);
    return uniqueImages;
  },
};