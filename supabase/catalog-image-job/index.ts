// catalog-image-job — DEV ONLY. Generates a product photo for catalogue products:
//   1. builds a prompt from the product's catalogue data (description, how it is sold,
//      category, diet) with a fixed visual recipe per product type,
//   2. generates with Gemini's image model,
//   3. has a second Gemini call CHECK the image (right product? text/logo? people? clean?),
//      regenerating with the reason fed back (max 3 attempts),
//   4. only a passing image is uploaded to Cloudinary (dealfynd/catalog/generic/<code>)
//      and saved in catalog_images as approved → trigger copies it to catalog_products.image_url.
//
// Auth: header `x-job-token` whose SHA-256 matches the digest below, or the project's service-role key as a
// Bearer token (used by the vedicjaalam.com admin catalogue "Regenerate" button).
// Body: { list?: true, names?: string[], codes?: string[], limit?: number (max 3), dry?: boolean, overwrite?: boolean,
//         hints?: { [code]: string } — saved to attributes.image_hint before generating }
// attributes.image_hint ("what it must look like") is added to both the prompt and the check.

// @ts-ignore: Deno global
declare const Deno: { env: { get(k: string): string | undefined }; serve: (h: (r: Request) => Promise<Response>) => void };
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b, null, 2), { status, headers: { 'Content-Type': 'application/json' } });

const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview'];
const JUDGE_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest'];
const MAX_ATTEMPTS = 3;

type Product = {
  id: string; code: string; name: string; description: string | null; image_url: string | null;
  is_restricted: boolean; attributes: Record<string, unknown> | null;
  catalog_categories: { name: string; slug: string; schema_id: string | null; parent: { name: string; slug: string } | null } | null;
  catalog_variants: { variant_label: string | null; unit: string | null }[];
  catalog_aliases: { alias: string; language: string }[];
};

// ── Product type → visual recipe ──────────────────────────────────────────────
function productForm(p: Product): string {
  const sub = (p.catalog_categories?.name || '').toLowerCase();
  const sector = (p.catalog_categories?.parent?.slug || p.catalog_categories?.slug || '').toLowerCase();
  const units = new Set(p.catalog_variants.map((v) => v.unit).filter(Boolean) as string[]);
  if (sector === 'food-dining') return 'dish';
  if (/fresh (vegetables|fruits)/.test(sub)) return 'produce';
  if (/chicken|mutton|meat|fish|seafood/.test(sub)) return 'raw_meat';
  if (sector === 'pharmacy-healthcare' && (units.has('tablet') || units.has('capsule') || units.has('strip'))) return 'medicine_strip';
  if (units.has('ml') || units.has('l')) return 'liquid';
  if ((units.has('g') || units.has('kg')) && /dal|pulse|rice|grain|flour|atta|millet|spice|masala|seed|dry fruit|nut|sugar|salt|tea|coffee|sweet|namkeen|snack/.test(sub + ' ' + p.name.toLowerCase())) return 'loose';
  if (units.has('g') || units.has('kg')) return 'packet';
  return 'object';
}

const RECIPES: Record<string, string> = {
  dish: 'a freshly prepared serving as plated in an ordinary Indian restaurant, on a plain plate, steel thali or bowl as appropriate, shot from a 45-degree angle, with its usual accompaniments only if they are always served with it',
  produce: 'fresh, as sold at an Indian vegetable/fruit shop: a small natural heap of a few pieces (or one bunch for leafy greens), realistic size and colour',
  raw_meat: 'fresh raw cuts as sold at an Indian meat or fish shop, neatly placed on a plain white tray, clean and appetising, no blood pooling',
  medicine_strip: 'one plain silver blister strip of tablets/capsules next to a plain white unlabelled carton, completely blank, no printing at all',
  liquid: 'in a plain, unlabelled bottle or jar typical for this product in India (glass or plastic as appropriate), with a little of the product visible if natural',
  loose: 'a small heap of the product in a plain steel bowl, a few grains/pieces spilling naturally beside it, showing the real texture and colour clearly',
  packet: 'one plain, unbranded, unlabelled pouch or box with a little of the product shown in front of it so the product itself is clearly recognisable',
  object: 'one example of the product, the most common everyday version sold in Indian shops, shown whole and clearly',
};

const hintOf = (p: Product) => String(p.attributes?.image_hint ?? '').trim();

function buildPrompt(p: Product, feedback?: string): string {
  const form = productForm(p);
  const hint = hintOf(p);
  const sector = p.catalog_categories?.parent?.name || p.catalog_categories?.name || '';
  const aka = p.catalog_aliases.filter((a) => a.language === 'en').map((a) => a.alias).slice(0, 3);
  const diet = String(p.attributes?.diet || '');
  const lines = [
    `Realistic studio product photograph of "${p.name}"${aka.length ? ` (also called ${aka.join(', ')})` : ''}, an item sold in India (${sector}).`,
    p.description ? `What it is: ${p.description}` : '',
    hint ? `It MUST look like this: ${hint}` : '',
    `Show it as ${RECIPES[form]}.`,
    diet === 'veg' || diet === 'vegan' ? 'It is vegetarian — do not include any meat, fish or egg.' : '',
    'Centered, filling most of the frame, plain pure-white background, soft even lighting, sharp focus, natural true-to-life colours.',
    'Absolutely no text, letters, numbers, labels, brand names, logos or watermarks anywhere. No people, no hands. Square 1:1.',
    feedback ? `IMPORTANT — the previous attempt was rejected because: ${feedback}. Fix this.` : '',
  ];
  return lines.filter(Boolean).join(' ');
}

// ── Gemini calls ──────────────────────────────────────────────────────────────
async function generate(apiKey: string, prompt: string) {
  let last = '';
  for (const model of IMAGE_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
      }),
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    if (!res.ok) { last = `${model} HTTP ${res.status}: ${text.slice(0, 200)}`; continue; }
    const data = JSON.parse(text);
    const part = (data?.candidates?.[0]?.content?.parts ?? []).find((x: any) => x?.inlineData?.data);
    if (part) return { b64: part.inlineData.data as string, mime: (part.inlineData.mimeType || 'image/png') as string, model };
    last = `${model}: no image (${data?.candidates?.[0]?.finishReason ?? 'unknown'})`;
  }
  throw new Error(last || 'image generation failed');
}

type Verdict = { shows_product: boolean; has_text_or_logo: boolean; has_people_or_hands: boolean; clean_background: boolean; quality_ok: boolean; issue: string };

async function judge(apiKey: string, p: Product, b64: string, mime: string): Promise<Verdict> {
  const q = [
    `You are checking a product photo for an Indian shopping catalogue. The product is "${p.name}".`,
    p.description ? `Description: ${p.description}` : '',
    hintOf(p) ? `It must look like this: ${hintOf(p)}. If it does not, shows_product is false.` : '',
    'The photo is deliberately unbranded: packaging, bottles, boxes and strips are meant to be completely blank.',
    'So NEVER fail it because the packaging is blank or does not name the product — for medicines, syrups and packaged',
    'goods judge only whether it shows the right KIND of item in a plausible form (e.g. a tablet strip for a tablet, a',
    'syrup bottle for a syrup). For foods, produce and objects it must clearly be this specific item, not a look-alike.',
    'Answer strictly: does the photo correctly show this product (not a different item)?',
    'Is there ANY text, letters, numbers, label printing, brand name or logo? Any people or hands?',
    'Is the background plain/clean? Is it a sharp, realistic, undistorted photo?',
    'In "issue" give one short sentence describing the main problem, or "" if none.',
  ].filter(Boolean).join(' ');
  let last = '';
  for (const model of JUDGE_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType: mime, data: b64 } }, { text: q }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            shows_product: { type: 'BOOLEAN' }, has_text_or_logo: { type: 'BOOLEAN' },
            has_people_or_hands: { type: 'BOOLEAN' }, clean_background: { type: 'BOOLEAN' },
            quality_ok: { type: 'BOOLEAN' }, issue: { type: 'STRING' },
          },
          required: ['shows_product', 'has_text_or_logo', 'has_people_or_hands', 'clean_background', 'quality_ok', 'issue'],
        },
      },
    }),
    signal: AbortSignal.timeout(45000),
  });
    const text = await res.text();
    if (!res.ok) { last = `judge ${model} HTTP ${res.status}: ${text.slice(0, 160)}`; continue; }
    const data = JSON.parse(text);
    const out = (data?.candidates?.[0]?.content?.parts ?? []).find((x: any) => x?.text && !x.thought)?.text;
    if (out) return JSON.parse(out);
    last = `judge ${model}: empty answer`;
  }
  throw new Error(last);
}

const passes = (v: Verdict) => v.shows_product && !v.has_text_or_logo && !v.has_people_or_hands && v.quality_ok;

// ── Cloudinary ────────────────────────────────────────────────────────────────
async function sha1Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function uploadCloudinary(b64: string, mime: string, publicId: string) {
  const cloud = Deno.env.get('CLOUDINARY_CLOUD_NAME')!;
  const key = Deno.env.get('CLOUDINARY_API_KEY')!;
  const secret = Deno.env.get('CLOUDINARY_API_SECRET')!;
  const folder = 'dealfynd/catalog/generic';
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${folder}&overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const form = new FormData();
  form.append('file', `data:${mime};base64,${b64}`);
  form.append('api_key', key); form.append('timestamp', String(timestamp));
  form.append('folder', folder); form.append('public_id', publicId); form.append('overwrite', 'true');
  form.append('signature', await sha1Hex(toSign + secret));
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(`Cloudinary ${res.status}: ${body?.error?.message ?? JSON.stringify(body).slice(0, 200)}`);
  return { url: body.secure_url as string, width: body.width as number, height: body.height as number };
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const given = req.headers.get('x-job-token') ?? '';
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(given)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const okToken = !!given && digest === '6f0598832c549309da9cf4fbfe9869a77da1c39e1dbb6886dcc1a730b9cbde9e';
  if (!okToken && !(srk && bearer === srk)) return json({ error: 'Unauthorized' }, 401);
  if (!(Deno.env.get('SUPABASE_URL') ?? '').includes('hyijwfovsvetpyrbqfcd')) return json({ error: 'DEV only' }, 403);

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body.limit) || 1, 1), 3);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'GEMINI_API_KEY not set' }, 500);

  if (body.hints && typeof body.hints === 'object') {
    for (const [code, h] of Object.entries(body.hints as Record<string, unknown>)) {
      const { data: cur } = await db.from('catalog_products').select('id, attributes').eq('code', code).maybeSingle();
      if (!cur) continue;
      const attrs = { ...((cur.attributes as Record<string, unknown>) ?? {}) };
      const t = String(h ?? '').trim().slice(0, 400);
      if (t) attrs.image_hint = t; else delete attrs.image_hint;
      await db.from('catalog_products').update({ attributes: attrs }).eq('id', cur.id);
    }
  }

  // { list: true } → codes of every active product still without a photo (for the bulk runner).
  if (body.list) {
    const codes: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('catalog_products').select('code')
        .eq('status', 'active').is('image_url', null).not('code', 'is', null).order('code').range(from, from + 999);
      if (error) return json({ error: error.message }, 500);
      codes.push(...(data ?? []).map((r: { code: string }) => r.code));
      if (!data || data.length < 1000) break;
    }
    return json({ count: codes.length, codes });
  }

  let q = db.from('catalog_products')
    .select('id, code, name, description, image_url, is_restricted, attributes, catalog_categories(name, slug, schema_id, parent:parent_id(name, slug)), catalog_variants(variant_label, unit), catalog_aliases(alias, language)')
    .eq('status', 'active');
  if (Array.isArray(body.names) && body.names.length) q = q.in('name', body.names);
  else if (Array.isArray(body.codes) && body.codes.length) q = q.in('code', body.codes);
  else q = q.eq('is_generic', true).eq('is_restricted', false).is('image_url', null).order('code');
  const { data: products, error } = await q.limit(limit);
  if (error) return json({ error: error.message }, 500);

  const results = [];
  for (const p of (products ?? []) as Product[]) {
    if (body.dry) { results.push({ code: p.code, name: p.name, form: productForm(p), prompt: buildPrompt(p) }); continue; }
    if (p.image_url && !body.overwrite) { results.push({ code: p.code, name: p.name, skipped: 'already has image', url: p.image_url }); continue; }
    const attempts: { issue: string; verdict?: Verdict }[] = [];
    let feedback: string | undefined;
    let saved: { url: string; model: string } | null = null;
    try {
      for (let i = 0; i < MAX_ATTEMPTS && !saved; i++) {
        const img = await generate(apiKey, buildPrompt(p, feedback));
        const verdict = await judge(apiKey, p, img.b64, img.mime);
        if (!passes(verdict)) {
          feedback = verdict.issue || (verdict.has_text_or_logo ? 'there is text or a logo' : 'it does not clearly show the product');
          attempts.push({ issue: feedback, verdict });
          continue;
        }
        const up = await uploadCloudinary(img.b64, img.mime, p.code);
        await db.from('catalog_images').delete().eq('product_id', p.id).eq('source', 'ai_generated');
        // Never displace a photo an admin or brand supplied as the main one.
        const { count: otherPrimary } = await db.from('catalog_images').select('id', { count: 'exact', head: true })
          .eq('product_id', p.id).is('variant_id', null).eq('is_primary', true);
        const { error: insErr } = await db.from('catalog_images').insert({
          product_id: p.id, url: up.url, is_primary: !otherPrimary, width: up.width, height: up.height,
          source: 'ai_generated', license: 'platform', attribution: `AI-generated illustration (${img.model}), auto-checked`,
          moderation_status: 'approved', moderation_note: `Auto-checked: passed on attempt ${i + 1}${hintOf(p) ? ' (with appearance hint)' : ''}`,
        });
        if (insErr) throw new Error(`save: ${insErr.message}`);
        saved = { url: up.url, model: img.model };
      }
      results.push(saved
        ? { code: p.code, name: p.name, form: productForm(p), url: saved.url, attempts: attempts.length + 1, rejected: attempts.map((a) => a.issue) }
        : { code: p.code, name: p.name, form: productForm(p), needs_attention: true, rejected: attempts.map((a) => a.issue) });
    } catch (e) {
      results.push({ code: p.code, name: p.name, error: (e as Error).message, rejected: attempts.map((a) => a.issue) });
    }
  }
  return json({ count: results.length, results });
});
