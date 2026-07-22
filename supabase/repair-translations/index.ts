
// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Inlined content of validation.ts
export function isValidUUID(uuid: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  const regex = /^\+[1-9]\d{1,14}$/; // E.g., +919999999999
  return regex.test(phone);
}

export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && value >= 0;
}

export function isString(value: any): boolean {
  return typeof value === 'string';
}

export function isBoolean(value: any): boolean {
  return typeof value === 'boolean';
}

export function isObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: any): boolean {
  return Array.isArray(value);
}

export function isDateString(value: string): boolean {
  return !isNaN(new Date(value).getTime());
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, at most 15, one uppercase, one number, and no spaces.
  const regex = /^(?=.*[A-Z])(?=.*\d)[^\s]{8,15}$/;
  return regex.test(password);
}
// End of inlined validation.ts

// Inlined content of authenticateRequest
export async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) {
    throw new Error('Unauthorized: No access token provided.');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);

  if (error || !user) {
    console.error('[authenticateRequest] JWT authentication failed:', error?.message);
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  return user;
}
// End of inlined authenticateRequest

// @google/genai Coding Guideline: Always use `import {GoogleGenAI, Type} from "@google/genai";`
import { GoogleGenAI, Type } from 'https://esm.sh/@google/genai@^1.35.0'; // Direct import in Edge Function

// Initialize Gemini API client within the Edge Function
// @google/geneline Coding Guideline: Always use `const ai = new GoogleGenAI({apiKey: process.env.API_KEY});`
const ai = new GoogleGenAI({ apiKey: Deno.env.get('GEMINI_API_KEY') || '' });
// @google/genai Coding Guideline: Use 'gemini-3-flash-preview' for basic text tasks.
const modelName = 'gemini-3-flash-preview'; // Ensure this model is available and appropriate

async function translateCampaignData(title: string, offer: string, desc: string, shopName: string): Promise<{ heading: any, offer: any, description: any, shop_name: any }> {
  if (!ai.apiKey) {
    console.warn("GEMINI_API_KEY is not set. Returning English fallbacks for translation.");
    return { 
      heading: { en: title }, 
      offer: { en: offer }, 
      description: { en: desc }, 
      shop_name: { en: shopName } 
    };
  }

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
      model: modelName,
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
    const text = response.text;
    if (!text) throw new Error("Gemini returned empty text.");
    return JSON.parse(text);
  } catch (e) {
    console.error("Gemini Translation failed (Edge Function):", e);
    return { 
      heading: { en: title }, 
      offer: { en: offer }, 
      description: { en: desc }, 
      shop_name: { en: shopName } 
    };
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  // 1. MUST HAVE THIS FOR EVERY FUNCTION
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY'); // Needed for authenticateRequest

  if (!supabaseUrl || !serviceRoleKey || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Supabase environment variables are not set.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  try {
    const user = await authenticateRequest(req);
    // Use service role client for direct database updates without RLS checks
    const serviceRoleSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { merchantId } = await req.json();

    // 1. Validate Input Data
    if (!isString(merchantId as string) || (merchantId as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Merchant ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    // Authorization check: Ensure the merchantId matches the authenticated user
    if (merchantId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Cannot repair translations for another merchant.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    const { data: campaigns, error: fetchError } = await serviceRoleSupabase
      .from('campaigns')
      .select('*')
      .eq('merchant_id', merchantId);
    
    if (fetchError) {
      throw fetchError;
    }

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ message: 'No campaigns found for this merchant to repair.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const updatePromises = campaigns.map(async (d: any) => {
      // Only translate if localized fields are missing or empty
      // <= 1 key means null or English-only (a failed Gemini call stores just
      // {en:...}); both still need a real translation, so re-translate them.
      if (Object.keys(d.localized_heading || {}).length <= 1 ||
          Object.keys(d.localized_offer || {}).length <= 1 ||
          Object.keys(d.localized_description || {}).length <= 1 ||
          Object.keys(d.localized_shop_name || {}).length <= 1) {
        
        console.log(`Repairing translations for campaign: ${d.campaign_id}`);
        const translations = await translateCampaignData(
          d.deal_heading || d.details || '', 
          d.offer_value || '', 
          d.long_description || '', 
          d.shop_name || "Retail Partner"
        );
        
        const { error: updateError } = await serviceRoleSupabase.from('campaigns').update({
          localized_heading: translations.heading,
          localized_offer: translations.offer,
          localized_description: translations.description,
          localized_shop_name: translations.shop_name
        }).eq('campaign_id', d.campaign_id);

        if (updateError) {
            console.error(`[campaigns/repair-translations EF] Failed to update translations for campaign ${d.campaign_id}:`, updateError.message);
            throw updateError;
        }
      }
    });

    await Promise.all(updatePromises);

    return new Response(JSON.stringify({ message: 'Campaign translations repaired successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Failed to repair campaign translations:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message.includes('Unauthorized') ? 401 : error.message.includes('Method Not Allowed') ? 405 : 500,
    });
  }
});