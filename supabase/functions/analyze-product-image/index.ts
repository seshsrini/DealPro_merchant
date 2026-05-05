// Analyze a product photo with Gemini Vision and return structured catalogue data.
// Replaces the SerpAPI-based product lookup with a photo-first workflow.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Try multiple model+endpoint combinations until one works.
// Some keys/regions only support v1 (not v1beta) and some models are renamed/deprecated.
const GEMINI_ATTEMPTS: Array<{ model: string; api: 'v1' | 'v1beta' }> = [
  { model: 'gemini-2.5-flash',     api: 'v1beta' },
  { model: 'gemini-2.0-flash',     api: 'v1beta' },
  { model: 'gemini-2.0-flash-001', api: 'v1beta' },
  { model: 'gemini-1.5-flash',     api: 'v1' },
  { model: 'gemini-1.5-flash',     api: 'v1beta' },
  { model: 'gemini-1.5-flash-002', api: 'v1' },
  { model: 'gemini-flash-latest',  api: 'v1' },
];

const PROMPT = `You are a product cataloguing assistant for "DealPro," an Indian retail deals marketplace.

Look at the image and identify the retail product. Return a structured JSON object.

Instructions:
1. Identify the Product Name (be specific — include brand if visible)
2. Identify the Category. You MUST pick exactly one of these 18 labels (use the exact spelling):
   Electronics, Mobiles & Accessories, Computers & Laptops, Appliances, Fashion & Apparel, Footwear, Beauty & Personal Care, Health & Wellness, Food & Grocery, Home & Kitchen, Furniture, Sports & Fitness, Toys & Games, Baby & Kids, Books & Stationery, Automotive, Jewellery & Watches, Pet Supplies
3. Suggest 3-5 relevant Attributes based on the category. Examples:
   - Fashion & Apparel: { "size": "M", "color": "Blue", "material": "Cotton", "gender": "Men" }
   - Food & Grocery: { "weight": "500g", "brand": "Maggi", "flavor": "Masala", "expiry_months": "12" }
   - Electronics / Mobiles: { "brand": "Samsung", "model": "A52", "color": "Black", "warranty": "1 year" }
   - Beauty & Personal Care: { "brand": "Lakme", "shade": "Honey", "size": "30ml", "type": "Liquid" }
4. Provide a brief, professional Description (max 20 words)
5. If you can read a price tag/MRP on the product, extract it as a number (in INR, no currency symbol). Otherwise return null.
6. Set "confidence" to "high" / "medium" / "low" based on how clearly you can identify the product.

If the image is unclear, blurry, or NOT a retail product (e.g., a person, scenery, random object), return:
{ "error": "Could not identify a product. Please retake the photo with better lighting and focus." }

Output format (JSON only, no markdown, no commentary):
{
  "product_name": "string",
  "category": "string",
  "suggested_attributes": { "key": "value" },
  "description": "string",
  "suggested_price": number or null,
  "confidence": "high" | "medium" | "low"
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      console.error('[analyze-product-image] GEMINI_API_KEY secret not set');
      return new Response(JSON.stringify({ error: 'AI service not configured.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { image_base64, mime_type } = body;

    if (!image_base64 || typeof image_base64 !== 'string') {
      return new Response(JSON.stringify({ error: 'image_base64 is required.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Strip the data URL prefix if present
    const cleanBase64 = image_base64.includes(',')
      ? image_base64.split(',')[1]
      : image_base64;

    const finalMime = mime_type || 'image/jpeg';

    const buildPayload = (useJsonMime: boolean) => ({
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: finalMime, data: cleanBase64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 800,
        ...(useJsonMime ? { responseMimeType: 'application/json' } : {}),
      },
    });

    // Try each model+endpoint combination, with and without responseMimeType
    let geminiResp: Response | null = null;
    let lastErrText = '';
    let usedModel = '';
    outer: for (const { model, api } of GEMINI_ATTEMPTS) {
      const url = `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${apiKey}`;
      for (const useJsonMime of [true, false]) {
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildPayload(useJsonMime)),
            signal: AbortSignal.timeout(20000),
          });
          if (resp.ok) {
            geminiResp = resp;
            usedModel = `${api}/${model}${useJsonMime ? ' (json)' : ' (text)'}`;
            console.log('[analyze-product-image] SUCCESS with:', usedModel);
            break outer;
          } else {
            lastErrText = await resp.text();
            console.warn(`[analyze-product-image] ${api}/${model} jsonMime=${useJsonMime} failed (${resp.status}):`, lastErrText.slice(0, 300));
          }
        } catch (fetchErr: any) {
          lastErrText = fetchErr?.message || 'Network error';
          console.warn(`[analyze-product-image] ${api}/${model} jsonMime=${useJsonMime} fetch failed:`, lastErrText);
        }
      }
    }

    if (!geminiResp) {
      console.error('[analyze-product-image] All Gemini models failed. Last error:', lastErrText);
      let detailMsg = 'AI analysis failed. Please try again.';
      try {
        const errJson = JSON.parse(lastErrText);
        if (errJson?.error?.message) {
          detailMsg = `AI error: ${errJson.error.message}`;
        }
      } catch {}
      return new Response(JSON.stringify({ error: detailMsg }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiData = await geminiResp.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[analyze-product-image] No text in Gemini response:', JSON.stringify(geminiData).slice(0, 500));
      return new Response(JSON.stringify({ error: 'AI returned empty response. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse the JSON response
    let parsed: any;
    try {
      // Strip any markdown fences just in case
      const cleanText = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error('[analyze-product-image] Failed to parse AI response:', text.slice(0, 300));
      return new Response(JSON.stringify({ error: 'AI returned invalid format. Please try again.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If AI couldn't identify the product, surface that as a 200 with the error field
    // (caller checks for `error` to know it's a soft failure, not a server error)
    if (parsed.error) {
      return new Response(JSON.stringify({ error: parsed.error, isAiError: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[analyze-product-image] Analysis success — product:', parsed.product_name, 'category:', parsed.category, 'confidence:', parsed.confidence);

    return new Response(JSON.stringify({
      success: true,
      product_name: parsed.product_name || '',
      category: parsed.category || 'General',
      suggested_attributes: parsed.suggested_attributes || {},
      description: parsed.description || '',
      suggested_price: typeof parsed.suggested_price === 'number' ? parsed.suggested_price : null,
      confidence: parsed.confidence || 'medium',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[analyze-product-image] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
