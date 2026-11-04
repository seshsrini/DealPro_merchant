// catalog-browse — DealFynd product catalogue for merchants (DEV ONLY for now).
//
// Actions (POST JSON, Authorization: Bearer <merchant JWT>):
//   tree      → { categories: [...], suggested: [sectorSlug...] }   category tree + counts;
//               "suggested" = sectors that match the merchant's store types
//   browse    → { products: [...], total }   body: { category?, query?, limit?, offset? }
//   suggest   → { products: [...] }           body: { query }   (type-ahead, 3+ chars)
//   bulk_add  → { added, skipped }            body: { items: [{ productId, variantId?, brandId?, brandName?, price?, mrp? }],
//                                                      storeIds? }  (defaults to all stores)
//   set_photo → { ok, imageUrl, contributed } body: { productId, imageUrl | null, width?, height?, agreedTerms }
//
// Products added from the catalogue land in public.products exactly like
// wizard-created ones, plus catalog_product_id / catalog_variant_id links.

// @ts-ignore: Deno is a global in Deno runtime
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MAX_BULK = 100;

// Store type (store_categories.category_name) → catalogue sectors to open first.
const STORE_TYPE_SECTORS: Array<[RegExp, string[]]> = [
  [/grocery|daily needs/i, ['grocery', 'specialty-food', 'beverages']],
  [/fruit|vegetable/i, ['grocery']],
  [/pharmacy|health|diagnostic|optical|eye care/i, ['pharmacy-healthcare']],
  [/bakery|chaat|juice/i, ['bakery-sweets-snacks', 'beverages']],
  [/cafe|ice cream|dining|restaurant/i, ['food-dining', 'beverages']],
  [/laptop|mobile/i, ['mobile-computing', 'electronics-appliances']],
  [/electric|electronic/i, ['electronics-appliances', 'hardware-building']],
  [/hardware/i, ['hardware-building']],
  [/foot ?wear/i, ['footwear-bags']],
  [/boutique|tailor|textile/i, ['textiles-tailoring', 'fashion-women']],
  [/fashion|lifestyle/i, ['fashion-women', 'fashion-men', 'fashion-kids']],
  [/beauty|salon|parlou?r/i, ['beauty']],
  [/stainless|home decor|furnish/i, ['home-kitchen']],
  [/sports|fitness/i, ['toys-sports-hobbies']],
  [/jewel/i, ['jewellery-watches']],
  [/kids|toys/i, ['baby-kids', 'toys-sports-hobbies']],
  [/gift|novelt/i, ['gifts-lifestyle']],
  [/book|stationary|stationery|printing/i, ['stationery-books', 'office-business']],
  [/pet/i, ['pet-supplies']],
  [/automotive/i, ['automotive']],
];

// Catalogue schema_id → the app's category label (same labels as UNIVERSAL_CATEGORIES).
const SCHEMA_LABEL: Record<string, string> = {
  grocery: 'Food & Grocery', restaurant: 'Food & Grocery', health: 'Health & Wellness',
  beauty: 'Beauty & Personal Care', electronics: 'Electronics', fashion: 'Fashion & Apparel',
  home: 'Home & Kitchen', furniture: 'Furniture', sports: 'Sports & Fitness', toys: 'Toys & Games',
  books: 'Books & Stationery', automotive: 'Automotive', jewellery: 'Jewellery & Watches',
};

async function resolveMerchant(req: Request, admin: ReturnType<typeof createClient>) {
  const auth = req.headers.get('Authorization');
  const jwt = auth?.startsWith('Bearer ') ? auth.substring(7) : null;
  if (!jwt) throw new Error('Unauthorized: No access token provided.');
  const { data: { user }, error } = await admin.auth.getUser(jwt);
  if (error || !user) {
    const reason = /expired/i.test(error?.message || '') ? 'expired' : 'invalid';
    throw new Error(`Unauthorized: token ${reason}`);
  }
  // Staff act on behalf of their owner merchant.
  let merchantId = user.id;
  const { data: staffRows } = await admin
    .from('merchant_staff').select('merchant_id').eq('user_id', user.id).eq('status', 'active');
  if (staffRows && staffRows.length > 0) {
    merchantId = (staffRows.find((r: any) => r.merchant_id !== user.id) || staffRows[0]).merchant_id;
  }
  const { data: profile } = await admin.from('merchant_profiles').select('role').eq('id', merchantId).maybeSingle();
  if (!profile || profile.role !== 'merchant') throw new Error('Forbidden: merchant profile not found.');
  return merchantId as string;
}

function cleanPrice(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[,₹\s]/g, ''));
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return String(Math.round(n * 100) / 100);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const merchantId = await resolveMerchant(req, admin);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'tree') {
      const { data, error } = await admin.rpc('catalog_category_tree');
      if (error) throw error;
      const { data: stores } = await admin
        .from('merchant_stores').select('store_category').eq('merchant_id', merchantId);
      const suggested: string[] = [];
      for (const s of stores || []) {
        const cat = String((s as any).store_category || '');
        for (const [re, sectors] of STORE_TYPE_SECTORS) {
          if (re.test(cat)) for (const sl of sectors) if (!suggested.includes(sl)) suggested.push(sl);
        }
      }
      const categories = (data || []).filter((c: any) => Number(c.product_count) > 0);
      return json({ categories, suggested });
    }

    if (action === 'browse' || action === 'suggest') {
      const query = typeof body.query === 'string' ? body.query.slice(0, 60) : null;
      if (action === 'suggest' && (!query || query.trim().length < 3)) return json({ products: [] });
      const { data, error } = await admin.rpc('catalog_browse', {
        p_category: action === 'browse' && typeof body.category === 'string' ? body.category : null,
        p_query: query,
        p_merchant: merchantId,
        p_limit: action === 'suggest' ? 8 : Math.min(Number(body.limit) || 40, 100),
        p_offset: action === 'suggest' ? 0 : Math.max(Number(body.offset) || 0, 0),
      });
      if (error) throw new Error(`RPC catalog_browse: ${error.message}${error.hint ? ` (${error.hint})` : ''}`);
      const rows = data || [];
      return json({ products: rows, total: rows.length ? Number(rows[0].total) : 0 });
    }

    if (action === 'bulk_add') {
      const items = Array.isArray(body.items) ? body.items.slice(0, MAX_BULK) : [];
      if (!items.length) return json({ error: 'Select at least one product.' }, 400);

      const productIds = [...new Set(items.map((i: any) => String(i.productId || '')).filter(Boolean))];
      const { data: catalog, error: catErr } = await admin
        .from('catalog_products')
        .select('id, name, description, image_url, is_restricted, attributes, catalog_categories(name, schema_id, is_restricted, parent:parent_id(name, schema_id))')
        .in('id', productIds).eq('status', 'active');
      if (catErr) throw catErr;
      const byId = new Map((catalog || []).map((p: any) => [p.id, p]));

      const { data: variants } = await admin
        .from('catalog_variants').select('id, product_id, variant_label, mrp').in('product_id', productIds);
      const variantById = new Map((variants || []).map((v: any) => [v.id, v]));

      // Catalogue brands referenced by the items (merchants may also type their own brand).
      const brandIds = [...new Set(items.map((i: any) => String(i.brandId || '')).filter(Boolean))];
      const { data: brandRows } = brandIds.length
        ? await admin.from('catalog_brands').select('id, name').in('id', brandIds)
        : { data: [] as any[] };
      const brandById = new Map((brandRows || []).map((b: any) => [b.id, b.name as string]));

      // Store links: requested stores that belong to this merchant, else all its stores.
      const { data: stores } = await admin.from('merchant_stores').select('id').eq('merchant_id', merchantId);
      const ownStoreIds = (stores || []).map((s: any) => s.id);
      const requested = Array.isArray(body.storeIds) ? body.storeIds.filter((id: unknown) => ownStoreIds.includes(id)) : [];
      const storeIds = requested.length ? requested : ownStoreIds;

      // Skip exact duplicates the merchant already has (same catalogue product + pack size).
      const { data: existing } = await admin
        .from('products').select('catalog_product_id, catalog_variant_id, attributes')
        .eq('merchant_id', merchantId).eq('is_active', true).in('catalog_product_id', productIds);
      const keyOf = (pid: string, vid: string | null, brand: string) =>
        `${pid}|${vid || ''}|${brand.trim().toLowerCase()}`;
      const have = new Set((existing || []).map((e: any) =>
        keyOf(e.catalog_product_id, e.catalog_variant_id, String(e.attributes?.brand || ''))));

      const rows: Record<string, unknown>[] = [];
      let skipped = 0;
      const now = new Date().toISOString();
      for (const it of items) {
        const p = byId.get(String(it.productId || ''));
        if (!p) { skipped++; continue; }
        const v = it.variantId ? variantById.get(String(it.variantId)) : null;
        if (it.variantId && (!v || v.product_id !== p.id)) { skipped++; continue; }
        let brand = '';
        if (it.brandId) {
          brand = brandById.get(String(it.brandId)) || '';
          if (!brand) { skipped++; continue; }
        } else if (typeof it.brandName === 'string') {
          brand = it.brandName.replace(/[^\p{L}\p{N}&'!.\- ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
        }
        const key = keyOf(p.id, v?.id || null, brand);
        if (have.has(key)) { skipped++; continue; }
        have.add(key);

        const cat = p.catalog_categories || {};
        const schemaId = cat.schema_id || cat.parent?.schema_id || 'general';
        const label = SCHEMA_LABEL[schemaId] || cat.parent?.name || cat.name || 'General';
        const price = cleanPrice(it.price);
        const mrp = cleanPrice(it.mrp) ?? (v?.mrp != null ? String(v.mrp) : null);
        const base = brand ? `${brand} ${p.name}` : p.name;
        const name = v?.variant_label ? `${base} (${v.variant_label})` : base;

        rows.push({
          name: name.slice(0, 200),
          category: String(label).slice(0, 50),
          image_url: p.image_url || null,
          additional_images: [],
          video_url: null,
          store_ids: storeIds,
          merchant_id: merchantId,
          attributes: {
            brand,
            ...(it.brandId && brand ? { catalog_brand_id: String(it.brandId) } : {}),
            price: price ?? '',
            mrp: mrp ?? '',
            schemaId,
            ...(v?.variant_label ? { pack_size: v.variant_label } : {}),
            ...(p.attributes?.diet ? { diet: p.attributes.diet } : {}),
            ...((p.is_restricted || cat.is_restricted) ? { restricted: true } : {}),
            source: 'catalogue',
          },
          description: p.description || null,
          stock_count: null,
          is_active: true,
          merchant_consent: true,
          merch_consent_date: now,
          catalog_product_id: p.id,
          catalog_variant_id: v?.id || null,
        });
      }

      if (rows.length) {
        const { error: insErr } = await admin.from('products').insert(rows);
        if (insErr) throw insErr;
      }
      console.log(`[catalog-browse] bulk_add merchant=${merchantId} added=${rows.length} skipped=${skipped}`);
      return json({ added: rows.length, skipped });
    }

    // set_photo — the merchant's own photo for a product they added from the catalogue.
    //   body: { productId (their products.id), imageUrl | null, width?, height?, agreedTerms: boolean }
    //   imageUrl null → back to the catalogue photo.
    // If the catalogue product has NO photo yet, the merchant's photo is also offered to the master
    // catalogue (catalog_images, pending owner review) under Terms 4.4, which the merchant agreed to
    // in the upload notice. Nothing is shown to other merchants until an owner approves it.
    if (action === 'set_photo') {
      const productId = String(body.productId || '');
      const { data: prod } = await admin.from('products')
        .select('id, merchant_id, catalog_product_id, image_url, attributes')
        .eq('id', productId).maybeSingle();
      if (!prod || prod.merchant_id !== merchantId) return json({ error: 'Product not found.' }, 404);
      if (!prod.catalog_product_id) return json({ error: 'This product was not added from the DealFynd catalogue.' }, 400);
      const { data: cat } = await admin.from('catalog_products')
        .select('id, image_url').eq('id', prod.catalog_product_id).maybeSingle();
      const attrs = { ...((prod.attributes as Record<string, unknown>) || {}) };

      if (body.imageUrl === null) {
        delete attrs.photo_source; delete attrs.photo_at;
        const { error } = await admin.from('products')
          .update({ image_url: cat?.image_url || null, attributes: attrs }).eq('id', prod.id);
        if (error) throw error;
        return json({ ok: true, imageUrl: cat?.image_url || null, contributed: false });
      }

      const imageUrl = String(body.imageUrl || '');
      if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^?#]+\/)?dealpro-products\/[^/?#]+$/.test(imageUrl)) {
        return json({ error: 'Upload the photo again.' }, 400);
      }
      if (body.agreedTerms !== true) return json({ error: 'Please agree to the photo terms first.' }, 400);
      const now = new Date().toISOString();
      attrs.photo_source = 'merchant';
      attrs.photo_at = now;
      const { error: upErr } = await admin.from('products').update({ image_url: imageUrl, attributes: attrs }).eq('id', prod.id);
      if (upErr) throw upErr;

      // Offer it to the master catalogue only when the catalogue product has no photo of its own.
      let contributed = false;
      const w = Number(body.width) || null;
      const h = Number(body.height) || null;
      const bigEnough = !w || !h || (w >= 400 && h >= 400); // catalog_images_min_size
      if (cat && !cat.image_url && bigEnough) {
        const { count } = await admin.from('catalog_images').select('id', { count: 'exact', head: true })
          .eq('product_id', cat.id).eq('url', imageUrl);
        if (!count) {
          const { error } = await admin.from('catalog_images').insert({
            product_id: cat.id, url: imageUrl, is_primary: false, width: w, height: h,
            source: 'merchant', license: 'merchant-terms-4.4', attribution: 'Photo by a DealFynd merchant',
            submitted_by_merchant: merchantId, moderation_status: 'pending',
            moderation_note: `Merchant photo, terms 4.4 agreed ${now}`,
          });
          if (error) console.warn('[catalog-browse] set_photo: catalogue offer failed:', error.message);
          else contributed = true;
        }
      }
      console.log(`[catalog-browse] set_photo merchant=${merchantId} product=${prod.id} contributed=${contributed}`);
      return json({ ok: true, imageUrl, contributed });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err: any) {
    const msg = String(err?.message || err);
    const status = msg.startsWith('Unauthorized') ? 401 : msg.startsWith('Forbidden') ? 403 : 500;
    console.error('[catalog-browse]', msg);
    // DEV: surface database errors so they can be diagnosed from the app.
    return json({ error: status === 500 && !msg.startsWith('RPC ') ? 'Something went wrong. Please try again.' : msg }, status);
  }
});
