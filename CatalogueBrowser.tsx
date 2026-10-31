/**
 * CatalogueBrowser.tsx
 * Browse the DealFynd product catalogue and add many products at once.
 *
 *   Sectors → (sub-category chips) → product list with checkboxes.
 *   Ticking a product opens its pack sizes; each ticked pack gets its own ₹ price box,
 *   so a merchant can list "Toor Dal 500 g ₹78" and "1 kg ₹150" in one go.
 *   Selections survive switching categories and searching. Price can be left blank
 *   and filled in later from the catalogue.
 *
 * Backend: catalog-browse edge function (tree / browse / bulk_add).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft, Search, X, Check, ChevronRight, Loader2, Package, Store, CheckCircle2, Sparkles,
} from 'lucide-react';
import { User, AppView, MerchantStore } from './types';
import { supabase, ensureFreshToken } from './services/supabaseClient';
import { merchantService } from './services/merchantService';

// ── API ───────────────────────────────────────────────────────────────────────

async function callCatalog<T = any>(body: Record<string, unknown>): Promise<T> {
  await ensureFreshToken().catch(() => { /* invoke wrapper retries on 401 */ });
  const { data, error } = await supabase.functions.invoke('catalog-browse', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

interface CatNode {
  id: number; parent_id: number | null; slug: string; name: string; level: number;
  schema_id: string | null; is_restricted: boolean; product_count: number;
}
interface Variant {
  id: string; label: string | null; qty: number | null; unit: string | null; mrp: number | null;
  typical: number | null;                          // reference price (approx.)
  market: number | null; market_shops: number | null; // median of what 3+ DealFynd merchants charge
}
interface CatProduct {
  product_id: string; name: string; description: string | null; image_url: string | null;
  category_name: string; sector_name: string; is_restricted: boolean; diet: string | null;
  variants: Variant[]; added: boolean;
  market_price: number | null; market_shops: number | null;
}
// productId → { product, packs: variantId ('' = no pack size) → price text }
type Selection = Map<string, { product: CatProduct; packs: Map<string, string> }>;

const PAGE = 40;

/** Price to pre-fill: what other merchants charge, else the reference price. */
function suggestedPrice(p: CatProduct, variantId: string): { value: string; hint: string } {
  if (!variantId) {
    return p.market_price != null
      ? { value: String(p.market_price), hint: `Usual price at ${p.market_shops} shops` }
      : { value: '', hint: '' };
  }
  const v = p.variants.find((x) => x.id === variantId);
  if (v?.market != null) return { value: String(v.market), hint: `Usual price at ${v.market_shops} shops` };
  if (v?.typical != null) return { value: String(Math.round(Number(v.typical))), hint: 'Approx. typical price' };
  return { value: '', hint: '' };
}
const NO_PACK = '';

// ── Small pieces ──────────────────────────────────────────────────────────────

const DietDot: React.FC<{ diet: string | null }> = ({ diet }) => {
  if (!diet) return null;
  const veg = diet === 'veg' || diet === 'vegan';
  const egg = diet === 'egg';
  return (
    <span
      title={diet}
      className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-[3px] border shrink-0 ${
        veg ? 'border-emerald-600' : egg ? 'border-amber-500' : 'border-red-600'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${veg ? 'bg-emerald-600' : egg ? 'bg-amber-500' : 'bg-red-600'}`} />
    </span>
  );
};

const PriceBox: React.FC<{
  value: string; onChange: (v: string) => void; isDark: boolean; placeholder?: string; autoFocus?: boolean;
}> = ({ value, onChange, isDark, placeholder = 'Price', autoFocus }) => (
  <div className={`flex items-center h-10 rounded-lg border px-2.5 w-28 shrink-0 ${
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
  }`}>
    <span className={`text-sm mr-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>₹</span>
    <input
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, '').slice(0, 9))}
      placeholder={placeholder}
      className={`w-full bg-transparent outline-none text-sm font-semibold ${
        isDark ? 'text-white placeholder-slate-600' : 'text-slate-900 placeholder-slate-400'
      }`}
    />
  </div>
);

// ── Screen ────────────────────────────────────────────────────────────────────

interface Props {
  user: User;
  theme: 'light' | 'dark';
  setView: (view: AppView) => void;
}

export const CatalogueBrowser: React.FC<Props> = ({ user, theme, setView }) => {
  const isDark = theme === 'dark';
  const merchantId = (user as any).staff_merchant_id || user.id;

  const [tree, setTree] = useState<CatNode[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [sector, setSector] = useState<CatNode | null>(null);
  const [sub, setSub] = useState<string | null>(null);   // sub-category slug
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  const [products, setProducts] = useState<CatProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const reqId = useRef(0);

  const [selection, setSelection] = useState<Selection>(new Map());
  const [reviewOpen, setReviewOpen] = useState(false);
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState<{ added: number; skipped: number } | null>(null);

  // Category tree + stores
  useEffect(() => {
    callCatalog<{ categories: CatNode[]; suggested: string[] }>({ action: 'tree' })
      .then((r) => { setTree(r.categories || []); setSuggested(r.suggested || []); })
      .catch(() => setTreeError('Could not load the catalogue. Check your connection and try again.'));
    merchantService.getMerchantStores(merchantId).then((s) => {
      setStores(s || []);
      setStoreIds((s || []).map((x: any) => String(x.id)));
    }).catch(() => {});
  }, [merchantId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const searching = debounced.length >= 2;
  const showList = !!sector || searching;
  const activeCategory = sub || sector?.slug || null;

  const load = useCallback(async (offset: number) => {
    const id = ++reqId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const r = await callCatalog<{ products: CatProduct[]; total: number }>({
        action: 'browse',
        category: activeCategory,
        query: searching ? debounced : null,
        limit: PAGE,
        offset,
      });
      if (id !== reqId.current) return;
      setProducts((prev) => (offset === 0 ? r.products : [...prev, ...r.products]));
      setTotal(r.total || 0);
    } catch {
      if (id === reqId.current) setLoadError('Could not load products. Pull back and try again.');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [activeCategory, searching, debounced]);

  useEffect(() => {
    if (showList) load(0);
    else { setProducts([]); setTotal(0); }
  }, [showList, load]);

  const sectors = useMemo(() => tree.filter((c) => c.level === 1), [tree]);
  const subs = useMemo(() => (sector ? tree.filter((c) => c.parent_id === sector.id) : []), [tree, sector]);
  const suggestedSectors = useMemo(
    () => suggested.map((s) => sectors.find((c) => c.slug === s)).filter(Boolean) as CatNode[],
    [suggested, sectors],
  );

  // ── Selection helpers ──
  const packCount = useMemo(() => {
    let n = 0;
    selection.forEach((s) => { n += s.packs.size; });
    return n;
  }, [selection]);

  const toggleProduct = (p: CatProduct) => {
    if (p.added) return;
    setSelection((prev) => {
      const next = new Map(prev);
      if (next.has(p.product_id)) next.delete(p.product_id);
      else {
        const first = p.variants[0]?.id ?? NO_PACK;
        next.set(p.product_id, { product: p, packs: new Map([[first, suggestedPrice(p, first).value]]) });
      }
      return next;
    });
  };

  const togglePack = (p: CatProduct, variantId: string) => {
    setSelection((prev) => {
      const next = new Map(prev);
      const cur = next.get(p.product_id);
      if (!cur) return prev;
      const packs = new Map(cur.packs);
      if (packs.has(variantId)) {
        packs.delete(variantId);
        if (!packs.size) { next.delete(p.product_id); return next; }
      } else packs.set(variantId, suggestedPrice(p, variantId).value);
      next.set(p.product_id, { ...cur, packs });
      return next;
    });
  };

  const setPrice = (productId: string, variantId: string, price: string) => {
    setSelection((prev) => {
      const next = new Map(prev);
      const cur = next.get(productId);
      if (!cur) return prev;
      const packs = new Map(cur.packs);
      packs.set(variantId, price);
      next.set(productId, { ...cur, packs });
      return next;
    });
  };

  const missingPrices = useMemo(() => {
    let n = 0;
    selection.forEach((s) => s.packs.forEach((price) => { if (!price) n++; }));
    return n;
  }, [selection]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const items: Array<{ productId: string; variantId: string | null; price: string }> = [];
    selection.forEach((s, productId) => s.packs.forEach((price, variantId) => {
      items.push({ productId, variantId: variantId || null, price });
    }));
    try {
      let added = 0, skipped = 0;
      for (let i = 0; i < items.length; i += 100) {
        const r = await callCatalog<{ added: number; skipped: number }>({
          action: 'bulk_add', items: items.slice(i, i + 100), storeIds,
        });
        added += r.added; skipped += r.skipped;
      }
      setDone({ added, skipped });
      setSelection(new Map());
      setReviewOpen(false);
      if (showList) load(0);   // refresh "Already in your catalogue" marks
    } catch (e: any) {
      setSaveError(e?.message && !/non-2xx/i.test(e.message) ? e.message : 'Could not add products. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (reviewOpen) { setReviewOpen(false); return; }
    if (query) { setQuery(''); return; }
    if (sector) { setSector(null); setSub(null); return; }
    setView('merchant_catalogue');
  };

  const variantLabel = (v: Variant | undefined) => v?.label || 'Standard';

  // ── Render ──
  const text = isDark ? 'text-white' : 'text-slate-900';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const card = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';

  if (done) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center px-8 text-center ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
        <h2 className={`text-xl font-bold mb-2 ${text}`}>
          {done.added} {done.added === 1 ? 'product' : 'products'} added
        </h2>
        <p className={`text-sm mb-8 ${muted}`}>
          {done.skipped > 0 ? `${done.skipped} already in your catalogue were skipped. ` : ''}
          You can add photos, prices and stock anytime from your catalogue.
        </p>
        <button
          onClick={() => setView('merchant_catalogue')}
          className="w-full max-w-xs h-14 rounded-xl bg-slate-900 text-white font-semibold active:scale-[0.98] transition-all"
        >
          View my catalogue
        </button>
        <button onClick={() => setDone(null)} className={`mt-4 text-sm font-medium ${muted}`}>
          Add more products
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pb-36 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header + search */}
      <div className={`sticky top-0 z-20 px-4 pt-4 pb-3 border-b ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={goBack} className={`w-10 h-10 -ml-2 rounded-full flex items-center justify-center ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`} aria-label="Back">
            <ArrowLeft className={`w-5 h-5 ${text}`} />
          </button>
          <div className="min-w-0">
            <h1 className={`text-lg font-semibold truncate ${text}`}>
              {searching ? 'Search results' : sector ? sector.name : 'Add from catalogue'}
            </h1>
            <p className={`text-xs ${muted}`}>
              {showList ? `${total} products` : 'Pick a category, tick products, set your price'}
            </p>
          </div>
        </div>
        <div className={`flex items-center h-11 rounded-xl px-3 border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <Search className={`w-4 h-4 mr-2 ${muted}`} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={sector ? `Search in ${sector.name}` : 'Search products, e.g. toor dal, dosa'}
            className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'}`}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search"><X className={`w-4 h-4 ${muted}`} /></button>
          )}
        </div>

        {/* Sub-category chips */}
        {sector && subs.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar mt-3 -mx-4 px-4">
            {[{ slug: null as string | null, name: 'All', product_count: sector.product_count }, ...subs].map((c) => {
              const active = sub === c.slug;
              return (
                <button
                  key={c.slug ?? 'all'}
                  onClick={() => setSub(c.slug)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                    active
                      ? isDark ? 'border-slate-400 bg-slate-700 text-white' : 'border-slate-900 bg-slate-900 text-white'
                      : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {c.name} ({c.product_count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sector grid */}
      {!showList && (
        <div className="px-4 pt-4">
          {treeError && <p className="text-sm text-red-500 mb-4">{treeError}</p>}
          {!treeError && !sectors.length && (
            <div className="flex justify-center py-16"><Loader2 className={`w-6 h-6 animate-spin ${muted}`} /></div>
          )}
          {suggestedSectors.length > 0 && (
            <>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1 ${muted}`}>
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> For your shop
              </p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {suggestedSectors.map((c) => (
                  <button key={`s-${c.slug}`} onClick={() => setSector(c)}
                    className={`text-left p-3 rounded-xl border-2 border-emerald-500/60 active:scale-[0.98] transition-all ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                    <p className={`text-sm font-semibold leading-tight ${text}`}>{c.name}</p>
                    <p className={`text-xs mt-1 ${muted}`}>{c.product_count} products</p>
                  </button>
                ))}
              </div>
            </>
          )}
          {sectors.length > 0 && (
            <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${muted}`}>All categories</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {sectors.map((c) => (
              <button key={c.slug} onClick={() => setSector(c)}
                className={`text-left p-3 rounded-xl border active:scale-[0.98] transition-all flex items-start justify-between gap-2 ${card}`}>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${text}`}>{c.name}</p>
                  <p className={`text-xs mt-1 ${muted}`}>{c.product_count} products</p>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 ${muted}`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Product list */}
      {showList && (
        <div className="px-4 pt-3 space-y-2">
          {products.map((p) => {
            const sel = selection.get(p.product_id);
            const checked = !!sel;
            return (
              <div key={p.product_id} className={`rounded-xl border overflow-hidden transition-all ${
                checked ? 'border-emerald-500 ring-1 ring-emerald-500/40' : ''
              } ${card} ${p.added ? 'opacity-60' : ''}`}>
                <button
                  onClick={() => toggleProduct(p)}
                  disabled={p.added}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${
                    checked ? 'bg-emerald-500 border-emerald-500' : isDark ? 'border-slate-600' : 'border-slate-300'
                  }`}>
                    {(checked || p.added) && <Check className={`w-4 h-4 ${checked ? 'text-white' : muted}`} />}
                  </span>
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    {p.image_url
                      ? <img src={p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      : <Package className={`w-5 h-5 ${muted}`} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <DietDot diet={p.diet} />
                      <p className={`text-sm font-semibold truncate ${text}`}>{p.name}</p>
                    </div>
                    <p className={`text-xs truncate ${muted}`}>
                      {p.added ? 'Already in your catalogue' : searching && !sector ? p.sector_name : p.category_name}
                      {p.is_restricted && <span className="ml-1.5 text-[10px] font-bold text-red-500">Rx</span>}
                    </p>
                  </div>
                </button>

                {/* Pack sizes + price, shown once ticked */}
                {sel && (
                  <div className={`px-3 pb-3 pt-1 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    {p.variants.length > 1 && (
                      <>
                        <p className={`text-[11px] font-medium mt-2 mb-1.5 ${muted}`}>Pack sizes you sell</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {p.variants.map((v) => {
                            const on = sel.packs.has(v.id);
                            return (
                              <button key={v.id} onClick={() => togglePack(p, v.id)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                  on ? 'bg-emerald-500 border-emerald-500 text-white'
                                     : isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'
                                }`}>
                                {variantLabel(v)}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                    <div className="space-y-2 mt-2">
                      {[...sel.packs.entries()].map(([vid, price], idx) => {
                        const sug = suggestedPrice(p, vid);
                        return (
                          <div key={vid || 'none'} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className={`block text-sm ${text}`}>
                                {vid ? variantLabel(p.variants.find((v) => v.id === vid)) : 'Your price'}
                              </span>
                              {sug.hint && (
                                <span className={`block text-[11px] ${price === sug.value ? 'text-emerald-600' : muted}`}>
                                  {price === sug.value ? `${sug.hint} · change if needed` : `${sug.hint}: ₹${sug.value}`}
                                </span>
                              )}
                            </div>
                            <PriceBox value={price} onChange={(v) => setPrice(p.product_id, vid, v)} isDark={isDark} autoFocus={idx === 0 && !price} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {loading && <div className="flex justify-center py-6"><Loader2 className={`w-6 h-6 animate-spin ${muted}`} /></div>}
          {loadError && <p className="text-sm text-red-500 text-center py-4">{loadError}</p>}
          {!loading && !loadError && products.length === 0 && (
            <p className={`text-sm text-center py-12 ${muted}`}>
              No products found{searching ? ` for “${debounced}”` : ''}. You can still add it yourself with “Add Product/Item”.
            </p>
          )}
          {!loading && products.length < total && (
            <button onClick={() => load(products.length)}
              className={`w-full h-11 rounded-xl text-sm font-medium border ${card} ${text}`}>
              Show more ({total - products.length} left)
            </button>
          )}
        </div>
      )}

      {/* Sticky action bar */}
      {packCount > 0 && !reviewOpen && (
        <div className={`fixed bottom-0 inset-x-0 z-30 px-4 pt-3 pb-safe-bottom border-t ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div>
            <button onClick={() => { setSaveError(null); setReviewOpen(true); }}
              className="w-full h-14 rounded-xl bg-slate-900 text-white font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              Review &amp; add {packCount} {packCount === 1 ? 'item' : 'items'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Review sheet */}
      {reviewOpen && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-end" onClick={() => !saving && setReviewOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
            className={`w-full max-h-[88vh] rounded-t-2xl flex flex-col ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-bold ${text}`}>Review {packCount} {packCount === 1 ? 'item' : 'items'}</h3>
                <p className={`text-xs ${muted}`}>
                  {missingPrices > 0 ? `${missingPrices} without a price — you can add it later` : 'All items have a price'}
                </p>
              </div>
              <button onClick={() => setReviewOpen(false)} disabled={saving} aria-label="Close">
                <X className={`w-5 h-5 ${muted}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 space-y-2 pb-3">
              {[...selection.values()].map(({ product: p, packs }) =>
                [...packs.entries()].map(([vid, price]) => (
                  <div key={`${p.product_id}-${vid}`} className={`flex items-center justify-between gap-3 py-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${text}`}>{p.name}</p>
                      <p className={`text-xs ${muted}`}>{vid ? variantLabel(p.variants.find((v) => v.id === vid)) : p.category_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriceBox value={price} onChange={(v) => setPrice(p.product_id, vid, v)} isDark={isDark} />
                      <button onClick={() => togglePack(p, vid || NO_PACK)} aria-label="Remove" className="p-1">
                        <X className={`w-4 h-4 ${muted}`} />
                      </button>
                    </div>
                  </div>
                )))}

              {stores.length > 1 && (
                <div className="pt-3">
                  <p className={`text-xs font-semibold mb-2 flex items-center gap-1 ${muted}`}>
                    <Store className="w-3.5 h-3.5" /> Show in stores
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {stores.map((s: any) => {
                      const id = String(s.id);
                      const on = storeIds.includes(id);
                      return (
                        <button key={id}
                          onClick={() => setStoreIds((prev) => on ? prev.filter((x) => x !== id) : [...prev, id])}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                            on ? 'bg-emerald-500 border-emerald-500 text-white'
                               : isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'
                          }`}>
                          {s.store_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className={`px-5 pt-3 pb-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              {saveError && <p className="text-sm text-red-500 mb-2">{saveError}</p>}
              <button onClick={handleSave} disabled={saving || packCount === 0 || (stores.length > 1 && storeIds.length === 0)}
                className="w-full h-14 rounded-xl bg-emerald-600 text-white font-semibold active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Add {packCount} to my catalogue</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
