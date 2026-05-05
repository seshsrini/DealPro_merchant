
import { supabase } from "./supabaseClient";
// @google/genai Coding Guideline: Always use `import {GoogleGenAI, Type} from "@google/genai";`
import { GoogleGenAI, Type } from "@google/genai";
import { Deal } from "../types";

// @google/genai Coding Guideline: Always use `const ai = new GoogleGenAI({apiKey: process.env.API_KEY});`
const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY });

// ──────────────────────────────────────────────────────────────────────────
// Image-verdict cache.
// LLM moderation is non-deterministic by default — the same image can flip
// verdicts between calls. We mitigate this in two layers:
//   1. `temperature: 0` on every Gemini call (below) for reproducibility.
//   2. Session-level memoization keyed on the file's SHA-256: once we have an
//      answer for a given image, re-uploads of the same bytes return the cached
//      verdict instantly (no AI call → no chance of disagreement).
// ──────────────────────────────────────────────────────────────────────────
type Verdict = { flagged: boolean; reason: string };
const _imageVerdictCache = new Map<string, Verdict>();
const _verdictCacheKey = (kind: 'mod' | 'cr', hash: string) => `${kind}:${hash}`;

async function sha256OfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const addCampaignService = {
  // AI-powered image moderation using Gemini multimodal — checks for inappropriate visual content.
  // Memoized by file SHA-256 so the same image always returns the same verdict in a session.
  moderateImage: async (imageFile: File): Promise<{ flagged: boolean; reason: string }> => {
    try {
      const hash = await sha256OfFile(imageFile);
      const cacheKey = _verdictCacheKey('mod', hash);
      const cached = _imageVerdictCache.get(cacheKey);
      if (cached) {
        console.log('[moderateImage] Cache hit — skipping AI call');
        return cached;
      }
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
          temperature: 0,
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
      const result: Verdict = JSON.parse(response.text || '{"flagged":false,"reason":""}');
      _imageVerdictCache.set(_verdictCacheKey('mod', hash), result);
      return result;
    } catch (e) {
      console.error('[moderateImage] AI image moderation failed:', e);
      // Don't block on AI failure
      return { flagged: false, reason: '' };
    }
  },

  // AI-powered copyright check using Gemini Vision — detects watermarks, screenshots, scraped images.
  // Memoized by file SHA-256 so the same image always returns the same verdict in a session.
  checkImageCopyright: async (imageFile: File): Promise<{ flagged: boolean; reason: string }> => {
    try {
      const hash = await sha256OfFile(imageFile);
      const cacheKey = _verdictCacheKey('cr', hash);
      const cached = _imageVerdictCache.get(cacheKey);
      if (cached) {
        console.log('[checkImageCopyright] Cache hit — skipping AI call');
        return cached;
      }
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
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
                text: `You are a copyright compliance checker for a commercial product catalogue platform.

Analyze this product image and check for signs of copyright infringement:

1. **Watermarks**: Look for visible text watermarks from stock photo sites (Shutterstock, Getty, iStock, Adobe Stock, Alamy, 123RF, Dreamstime, etc.) or any photographer/studio watermarks
2. **Screenshots**: Check if this is a screenshot from another e-commerce site (Amazon, Flipkart, Myntra, etc.) — look for browser chrome, address bars, add-to-cart buttons, ratings UI, price tags from other platforms
3. **Scraped images**: Look for other company logos overlaid on the product, website URLs embedded in the image, or obvious web page artifacts
4. **Google Images**: Check if the image appears to be a direct save from Google Image search (has Google UI elements)

If the image is an original photo taken by the merchant (even if low quality), a product photo on a plain background, or a promotional graphic made by the merchant — do NOT flag it.

Only flag if there are CLEAR visual indicators of copyright infringement as described above.
Return the reason in English.`,
              },
            ],
          },
        ],
        config: {
          temperature: 0,
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
      const result: Verdict = JSON.parse(response.text || '{"flagged":false,"reason":""}');
      _imageVerdictCache.set(_verdictCacheKey('cr', hash), result);
      return result;
    } catch (e) {
      console.error('[checkImageCopyright] AI copyright check failed:', e);
      return { flagged: false, reason: '' };
    }
  },

  // AI-powered content moderation using Gemini — catches context-based inappropriate content
  moderateContent: async (title: string, offer: string, description: string): Promise<{ flagged: boolean; reason: string }> => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a strict multilingual content moderator for a commercial deals and coupons platform in India.

The text below may be in ANY Indian language — Hindi, Kannada, Tamil, Telugu, Malayalam, Bengali, Marathi, Gujarati, or English. You MUST detect inappropriate content regardless of which language or script it is written in.

Step 1: If the text is NOT in English, mentally translate it to English first.
Step 2: Analyze the translated (or original English) text for:
- Profanity, vulgar language, or abusive slang (including transliterated slang like "BC", "MC", etc.)
- Sexual content, innuendo, or suggestive language
- Hate speech, discrimination, casteist or communal slurs
- Harassment, threats, or violent language
- Personal messages disguised as deals

${title ? `Deal Title: "${title}"` : ''}
${offer ? `Offer Value: "${offer}"` : ''}
${description ? `Deal Description: "${description}"` : ''}

IMPORTANT: Only check the fields that have content above. Empty or missing fields are being filled in separately and should NOT be flagged.
Be strict about inappropriate language. If the provided content is a normal commercial deal/offer text, do NOT flag it.
Only flag if the actual text content is inappropriate for a family-friendly commercial platform.
ALWAYS return the reason in English regardless of the input language.`,
        config: {
          temperature: 0,
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
  
  // Calls Edge Function to get deals specific to a merchant.
  // The edge function returns raw DB rows with snake_case keys and a nested
  // `merchant_stores` join. We map them here so the rest of the app can use
  // the camelCase `Deal` interface (e.g. `deal.shopName`).
  getMerchantDeals: async (merchantId: string): Promise<Deal[]> => {
    console.log(`[addCampaignService] Invoking 'get-by-merchant' for merchant ID: ${merchantId}`);
    const { data, error } = await supabase.functions.invoke('get-by-merchant', {
      body: { merchantId },
    });
    if (error) throw new Error('Unable to process campaign. Please try again.');
    if (!Array.isArray(data)) return [];
    return data.map((d: any) => ({
      ...d,
      campaign_id: String(d.campaign_id || d.id),
      merchantId: d.merchant_id,
      shopName: d.shop_name || d.merchant_stores?.store_name || '',
      thumbnail: d.image_url || d.thumbnail || '',
      details: d.deal_heading || d.details || '',
      deal_heading: d.deal_heading || '',
      offerValue: d.offer_value || d.offerValue || '',
      offer_value: d.offer_value || '',
      location: d.merchant_stores?.address || d.address || d.location || '',
      address: d.merchant_stores
        ? [d.merchant_stores.address, d.merchant_stores.locality, d.merchant_stores.city, d.merchant_stores.state, d.merchant_stores.pincode].filter(Boolean).join(', ')
        : (d.address || d.location || ''),
      landmark: d.merchant_stores?.landmark || d.landmark || '',
      storeHrs: d.merchant_stores?.store_hrs || '',
      storePhone: d.merchant_stores?.store_phone || null,
      storePhoneAlt: d.merchant_stores?.store_phone_alt || null,
      delivers: d.merchant_stores?.delivers ?? false,
      delivery_radius_km: d.merchant_stores?.delivery_radius_km ?? null,
      city: d.merchant_stores?.city || d.city || '',
      localized_shop_name: d.localized_shop_name || {},
      localized_heading: d.localized_heading || {},
      localized_offer: d.localized_offer || {},
    })) as Deal[];
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

  // Direct client-to-Cloudinary upload (fast — no Edge Function proxy for the file).
  // `folderOverride` lets callers route to the drafts folder (`dealpro-drafts`) so
  // uploads tied to in-progress wizard state can be cleaned up if the draft expires.
  uploadDealImage: async (
    mId: string,
    file: File,
    folderOverride?: string,
  ): Promise<{ publicUrl: string, imageName: string }> => {
    // Step 1 — get signature from edge function (lightweight JSON call)
    const { data: signData, error: signErr } = await supabase.functions.invoke('cloudinary-sign', {
      body: { folder: folderOverride || 'dealpro-campaigns' },
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

  /**
   * Upload to the `dealpro-drafts` folder. Used by the wizard so in-flight images
   * can be persisted to the draft row and resumed across sessions/devices.
   * Use `destroyDraftImages` to clean up if the draft is abandoned / Started Over.
   */
  uploadDealImageDraft: async (mId: string, file: File): Promise<{ publicUrl: string, imageName: string }> => {
    return addCampaignService.uploadDealImage(mId, file, 'dealpro-drafts');
  },

  /**
   * Destroy a list of Cloudinary assets by URL. Used when a draft is abandoned
   * (Start Over button) or expires via the cleanup cron — prevents orphaned
   * drafts/* assets from accumulating in the Cloudinary account.
   * Failures are logged but never thrown — orphan cleanup is best-effort.
   */
  destroyDraftImages: async (urls: string[]): Promise<void> => {
    if (!urls || urls.length === 0) return;
    // Only destroy assets we know are drafts — extra safety against accidentally
    // deleting a published deal's image if someone passes the wrong URL.
    const draftUrls = urls.filter(u => /\/dealpro-drafts\//.test(u));
    if (draftUrls.length === 0) return;
    try {
      const { error } = await supabase.functions.invoke('cloudinary-destroy', {
        body: { urls: draftUrls },
      });
      if (error) console.warn('[destroyDraftImages] EF error (best-effort):', error.message);
    } catch (err: any) {
      console.warn('[destroyDraftImages] Threw (best-effort):', err?.message || err);
    }
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