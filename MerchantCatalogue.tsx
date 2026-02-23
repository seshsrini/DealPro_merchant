/**
 * MerchantCatalogue.tsx
 * Standalone product catalogue for merchants.
 * Merchants can add, edit, and delete products in their catalogue.
 * Not connected to deals — a pure product showcase & inventory table.
 *
 * Storage: Supabase `products` table — attributes stored as jsonb.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, X, Edit2, Trash2, Package, ChevronDown, AlertCircle,
} from 'lucide-react';
import { User, AppView } from './types';
import { CATEGORY_SCHEMAS, getSchemaForCategory, CategorySchema } from './data/formSchema';
import { ProductLookup } from './components/ProductCatalog/ProductLookup';
import { ImageUploader } from './components/ProductCatalog/ImageUploader';
import { ProductData } from './services/productLookupService';
import { supabase } from './services/supabaseClient';
import { fetchStoreCategories } from './services/categoryService';

// ── Edge Function helper ───────────────────────────────────────────────────────

async function callManageProducts(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-products', { body });
  if (error) throw error;
  return data as Record<string, unknown>;
}

// ── Data Model ────────────────────────────────────────────────────────────────

export interface CatalogueItem {
  id: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  category: string;
  schemaId: string;
  specs: Record<string, string>;
  price: string;
  mrp: string;
  stock: 'in_stock' | 'out_of_stock' | 'limited';
  createdAt: string;
}

// ── Supabase row ↔ CatalogueItem converters ──────────────────────────────────

function rowToItem(row: Record<string, unknown>): CatalogueItem {
  const attrs = (row.attributes as Record<string, string>) ?? {};
  const { brand = '', price = '', mrp = '', stock = 'in_stock', schemaId = 'general', ...specs } = attrs;
  const validStock = (['in_stock', 'out_of_stock', 'limited'] as const).includes(stock as CatalogueItem['stock'])
    ? (stock as CatalogueItem['stock'])
    : 'in_stock';
  return {
    id:        row.id as string,
    name:      row.name as string,
    brand,
    imageUrl:  (row.image_url as string | null) ?? null,
    category:  row.category as string,
    schemaId,
    specs,
    price,
    mrp,
    stock:     validStock,
    createdAt: row.created_at as string,
  };
}

function itemToRow(item: Omit<CatalogueItem, 'id' | 'createdAt'>, merchantId: string) {
  const { brand, price, mrp, stock, schemaId, specs } = item;
  return {
    name:        item.name,
    category:    item.category.slice(0, 50),
    image_url:   item.imageUrl,
    merchant_id: merchantId,
    attributes:  { brand, price, mrp, stock, schemaId, ...specs },
    is_active:   true,
  };
}

// ── Blank form state ──────────────────────────────────────────────────────────

function blankForm(schemaId = 'general'): Omit<CatalogueItem, 'id' | 'createdAt'> {
  return {
    name: '', brand: '', imageUrl: null,
    category: getSchemaForCategory(schemaId).label,
    schemaId,
    specs: {},
    price: '', mrp: '',
    stock: 'in_stock',
  };
}

// ── Stock metadata ────────────────────────────────────────────────────────────

const STOCK_META: Record<CatalogueItem['stock'], { label: string; tw: string }> = {
  in_stock:     { label: 'In Stock',     tw: 'text-emerald-500' },
  limited:      { label: 'Limited',      tw: 'text-amber-500' },
  out_of_stock: { label: 'Out of Stock', tw: 'text-red-500' },
};

// ── Product Entry Panel (portal) ──────────────────────────────────────────────

interface PanelProps {
  item: Omit<CatalogueItem, 'id' | 'createdAt'>;
  setItem: React.Dispatch<React.SetStateAction<Omit<CatalogueItem, 'id' | 'createdAt'>>>;
  isEdit: boolean;
  saving: boolean;
  theme: 'light' | 'dark';
  merchantCategory: string;
  categories: string[];
  onSave: () => void;
  onClose: () => void;
}

const ProductEntryPanel: React.FC<PanelProps> = ({
  item, setItem, isEdit, saving, theme, merchantCategory, categories, onSave, onClose,
}) => {
  const isDark = theme === 'dark';
  const schema: CategorySchema = getSchemaForCategory(item.schemaId);
  const [showLookup, setShowLookup] = useState(!isEdit);
  const [justFilled, setJustFilled] = useState(false);

  useEffect(() => {
    if (!justFilled) return;
    const t = setTimeout(() => setJustFilled(false), 2500);
    return () => clearTimeout(t);
  }, [justFilled]);

  const handleLookupResult = useCallback((product: ProductData) => {
    const detectedSchema = getSchemaForCategory(product.detectedSchemaId);
    const numericPrice = (product.specs.price ?? '').replace(/[^\d.]/g, '').replace(/\.(?=.*\.)/g, '');
    setItem(prev => ({
      ...prev,
      name:     product.name     || prev.name,
      brand:    product.brand    || prev.brand,
      imageUrl: null,
      category: detectedSchema.label,
      schemaId: detectedSchema.id,
      specs:    { ...prev.specs, ...product.specs },
      price:    numericPrice    || prev.price,
    }));
    setShowLookup(false);
    setJustFilled(true);
  }, [setItem]);

  const setField = (key: string, value: string) =>
    setItem(prev => ({ ...prev, [key]: value }));

  const setSpec = (key: string, value: string) =>
    setItem(prev => ({ ...prev, specs: { ...prev.specs, [key]: value } }));

  const inputClass = `w-full h-11 px-4 rounded-lg text-sm outline-none border ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-slate-500'
      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
  }`;

  const panelContent = (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Mobile-constrained container */}
      <div className="max-w-md mx-auto w-full h-full relative">
        {/* Slide-up panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-slate-900' : 'bg-white'
          }`}
          style={{ maxHeight: '92dvh' }}
          onClick={e => e.stopPropagation()}
        >
        {/* Panel handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 flex items-center justify-between">
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h2>
          <button
            onClick={onClose}
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-4">

          {/* Product Lookup */}
          <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <button
              onClick={() => setShowLookup(v => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium ${
                isDark ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'
              }`}
            >
              <span>Auto-fill from Barcode / Product Name</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showLookup ? 'rotate-180' : ''}`} />
            </button>
            {showLookup && (
              <div className={`px-4 pb-4 pt-2 ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                <ProductLookup
                  hintCategory={merchantCategory}
                  onResult={handleLookupResult}
                  theme={theme}
                />
              </div>
            )}
          </div>

          {/* "Fields filled" banner */}
          {justFilled && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border ${
              isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <span className="text-emerald-500 text-sm">✓</span>
              <p className="text-emerald-500 text-xs font-medium">Details filled — upload your product image below and save.</p>
            </div>
          )}

          {/* Image upload */}
          <ImageUploader
            value={item.imageUrl}
            onChange={url => setItem(p => ({ ...p, imageUrl: url }))}
            theme={theme}
            categoryLabel={item.category}
          />

          {/* Name */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Product name"
              value={item.name}
              onChange={e => setField('name', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Brand */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Brand
            </label>
            <input
              type="text"
              placeholder="Brand name"
              value={item.brand}
              onChange={e => setField('brand', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Category */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Category
            </label>
            <select
              value={item.category}
              onChange={e => {
                const selectedCategory = e.target.value;
                const matchedSchema = getSchemaForCategory(selectedCategory);
                setItem(prev => ({
                  ...prev,
                  category: selectedCategory,
                  schemaId: matchedSchema.id,
                  specs: {}
                }));
              }}
              className={inputClass}
            >
              {categories.length > 0 ? (
                categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))
              ) : (
                CATEGORY_SCHEMAS.map(s => (
                  <option key={s.id} value={s.label}>{s.label}</option>
                ))
              )}
            </select>
          </div>

          {/* Dynamic fields from formSchema */}
          {schema.fields
            .filter(f => f.key !== 'brand')
            .map(field => {
              const val = item.specs[field.key] ?? '';
              if (field.type === 'select') {
                return (
                  <div key={field.key}>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {field.label}
                    </label>
                    <select
                      value={val}
                      onChange={e => setSpec(field.key, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">-- Select --</option>
                      {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                );
              }
              if (field.type === 'boolean') {
                return (
                  <div key={field.key} className="flex items-center justify-between">
                    <label className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{field.label}</label>
                    <button
                      onClick={() => setSpec(field.key, val === 'true' ? 'false' : 'true')}
                      className={`w-12 h-6 rounded-full transition-all ${val === 'true' ? 'bg-emerald-500' : isDark ? 'bg-slate-600' : 'bg-slate-300'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${val === 'true' ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                );
              }
              if (field.type === 'textarea') {
                return (
                  <div key={field.key}>
                    <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {field.label}
                    </label>
                    <textarea
                      rows={3}
                      placeholder={field.placeholder}
                      value={val}
                      onChange={e => setSpec(field.key, e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg text-sm outline-none border resize-none ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>
                );
              }
              return (
                <div key={field.key}>
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {field.label}{field.unit ? ` (${field.unit})` : ''}
                  </label>
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    placeholder={field.placeholder}
                    value={val}
                    onChange={e => setSpec(field.key, e.target.value)}
                    className={inputClass}
                  />
                </div>
              );
            })}

          {/* Price + MRP */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Selling Price (₹)
              </label>
              <input
                type="number"
                placeholder="0"
                value={item.price}
                onChange={e => setField('price', e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                MRP (₹)
              </label>
              <input
                type="number"
                placeholder="0"
                value={item.mrp}
                onChange={e => setField('mrp', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Stock status */}
          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Stock Status
            </label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(STOCK_META) as CatalogueItem['stock'][]).map(s => (
                <button
                  key={s}
                  onClick={() => setItem(p => ({ ...p, stock: s }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    item.stock === s
                      ? isDark ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-emerald-500 bg-emerald-50 text-emerald-600'
                      : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {STOCK_META[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`shrink-0 px-6 py-4 border-t flex gap-3 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <button
            onClick={onClose}
            className={`flex-1 h-12 rounded-xl text-sm font-medium border ${
              isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!item.name.trim() || saving}
            className="flex-1 h-12 rounded-xl text-sm font-semibold text-white bg-slate-900 disabled:opacity-40"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add to Catalogue'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );

  return createPortal(panelContent, document.body);
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface Props {
  user: User;
  theme: 'light' | 'dark';
  setView: (view: AppView) => void;
}

export const MerchantCatalogue: React.FC<Props> = ({ user, theme }) => {
  const isDark = theme === 'dark';
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [filterSchemaId, setFilterSchemaId] = useState<string>('all');
  const [showPanel, setShowPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<CatalogueItem, 'id' | 'createdAt'>>(blankForm(user.category ?? 'general'));
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchStoreCategories()
      .then(cats => {
        console.log('[MerchantCatalogue] Loaded categories:', cats);
        setCategories(cats);
      })
      .catch(err => console.error('[MerchantCatalogue] Failed to load categories:', err));
  }, []);

  useEffect(() => {
    callManageProducts({ action: 'list', merchantId: user.id })
      .then(res => {
        const rows = (res.products as Record<string, unknown>[]) ?? [];
        setItems(rows.map(rowToItem));
      })
      .catch(() => {});
  }, [user.id]);

  const openAdd = () => {
    setFormData(blankForm(user.category ?? 'general'));
    setEditingId(null);
    setShowPanel(true);
  };

  const openEdit = (item: CatalogueItem) => {
    const { id, createdAt, ...rest } = item;
    setFormData(rest);
    setEditingId(id);
    setShowPanel(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    if (!editingId) {
      setShowConsentModal(true);
      return;
    }
    await proceedWithSave();
  };

  const proceedWithSave = async () => {
    setSaving(true);
    try {
      const row = itemToRow(formData, user.id);
      if (editingId) {
        const res = await callManageProducts({
          action:     'update',
          merchantId: user.id,
          productId:  editingId,
          name:       row.name,
          category:   row.category,
          image_url:  row.image_url,
          attributes: row.attributes,
        });
        if (res.product) {
          setItems(prev => prev.map(i =>
            i.id === editingId ? rowToItem(res.product as Record<string, unknown>) : i
          ));
        }
      } else {
        const res = await callManageProducts({
          action:          'insert',
          merchantId:      user.id,
          name:            row.name,
          category:        row.category,
          image_url:       row.image_url,
          attributes:      row.attributes,
          merchant_consent: true,
        });
        if (res.product) setItems(prev => [rowToItem(res.product as Record<string, unknown>), ...prev]);
      }
    } finally {
      setSaving(false);
    }
    setShowPanel(false);
    setShowConsentModal(false);
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await callManageProducts({ action: 'delete', merchantId: user.id, productId: id });
    setItems(prev => prev.filter(i => i.id !== id));
    setDeleteConfirmId(null);
  };

  const displayed = filterSchemaId === 'all'
    ? items
    : items.filter(i => i.schemaId === filterSchemaId);

  const usedSchemaIds = Array.from(new Set(items.map(i => i.schemaId)));

  return (
    <div className={`min-h-screen pb-40 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>

      {/* Page header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Product Catalogue
            </h1>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {items.length} {items.length === 1 ? 'product' : 'products'} listed
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Category filter tabs */}
      {usedSchemaIds.length > 1 && (
        <div className="px-6 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterSchemaId('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
              filterSchemaId === 'all'
                ? isDark ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-900 bg-slate-900 text-white'
                : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
            }`}
          >
            All ({items.length})
          </button>
          {usedSchemaIds.map(sid => {
            const schema = CATEGORY_SCHEMAS.find(s => s.id === sid);
            const count = items.filter(i => i.schemaId === sid).length;
            return (
              <button
                key={sid}
                onClick={() => setFilterSchemaId(sid)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  filterSchemaId === sid
                    ? isDark ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-900 bg-slate-900 text-white'
                    : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                {schema?.label.split(' ')[0] ?? sid} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 ${
            isDark ? 'bg-slate-800' : 'bg-slate-100'
          }`}>
            <Package className={`w-8 h-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            No products yet
          </h3>
          <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Build your product catalogue. Use barcode or name lookup to auto-fill details.
          </p>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 h-11 px-6 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Add First Product
          </button>
        </div>
      )}

      {/* Product grid */}
      {displayed.length > 0 && (
        <div className="px-4 grid grid-cols-2 gap-3">
          {displayed.map(item => {
            const stockMeta = STOCK_META[item.stock];
            const hasDiscount = item.mrp && item.price && parseFloat(item.mrp) > parseFloat(item.price);
            const discountPct = hasDiscount
              ? Math.round((1 - parseFloat(item.price) / parseFloat(item.mrp)) * 100)
              : 0;

            return (
              <div
                key={item.id}
                className={`rounded-xl overflow-hidden border ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                {/* Image */}
                <div className={`relative w-full aspect-square flex items-center justify-center ${
                  isDark ? 'bg-slate-800' : 'bg-slate-50'
                }`}>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-contain"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <Package className={`w-12 h-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                  )}
                  {/* Discount badge */}
                  {discountPct > 0 && (
                    <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                      {discountPct}% off
                    </span>
                  )}
                  {/* Action buttons */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                    <button
                      onClick={() => openEdit(item)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isDark ? 'bg-slate-900/80 text-white' : 'bg-white/80 text-slate-700'
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(item.id)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isDark ? 'bg-slate-900/80' : 'bg-white/80'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  {item.brand && (
                    <p className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {item.brand}
                    </p>
                  )}
                  <p className={`text-sm font-medium leading-snug line-clamp-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {item.name}
                  </p>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {item.category.split(' ')[0]}
                  </p>

                  {/* Price row */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {item.price && (
                      <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        ₹{item.price}
                      </span>
                    )}
                    {hasDiscount && (
                      <span className={`text-xs line-through ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        ₹{item.mrp}
                      </span>
                    )}
                  </div>

                  {/* Stock */}
                  <p className={`text-[10px] font-medium mt-1 ${stockMeta.tw}`}>
                    {stockMeta.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No results for filter */}
      {items.length > 0 && displayed.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center px-6">
          <AlertCircle className={`w-10 h-10 mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            No products in this category
          </p>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirmId && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6 bg-black/50">
          <div className={`w-full max-w-sm rounded-xl p-6 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'}`}>
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Remove product?
            </h3>
            <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              This will remove the product from your catalogue. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className={`flex-1 h-12 rounded-xl text-sm font-medium border ${
                  isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 h-12 rounded-xl text-sm font-semibold bg-red-500 text-white"
              >
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Copyright Consent Modal */}
      {showConsentModal && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center px-6 bg-black/50">
          <div className={`w-full max-w-md rounded-xl p-6 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'}`}>
            <h3 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Copyright & Image Rights
            </h3>
            <div className={`text-sm leading-relaxed mb-6 space-y-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <p>By adding this product, you confirm and warrant that:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>You own the copyright to this product image, or have obtained proper written authorization from the copyright holder to use it</li>
                <li>The image does not infringe on any third-party intellectual property rights, trademarks, or copyrights</li>
                <li>You assume full legal responsibility for any copyright claims, disputes, or legal issues arising from the use of this image</li>
              </ul>
              <p className="pt-2 font-medium">
                DealPro and its affiliated companies shall not be held liable for any copyright infringement, legal claims, or damages resulting from images uploaded by merchants.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConsentModal(false);
                  setSaving(false);
                }}
                className={`flex-1 h-12 rounded-xl text-sm font-medium border ${
                  isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={proceedWithSave}
                className="flex-1 h-12 rounded-xl text-sm font-semibold bg-slate-900 text-white"
              >
                I Agree & Accept
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Product Entry Panel */}
      {showPanel && (
        <ProductEntryPanel
          item={formData}
          setItem={setFormData}
          isEdit={editingId !== null}
          saving={saving}
          theme={theme}
          merchantCategory={user.category ?? ''}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowPanel(false); setEditingId(null); }}
        />
      )}
    </div>
  );
};
