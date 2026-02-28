/**
 * MerchantCatalogue.tsx
 * Standalone product catalogue for merchants.
 * Merchants can view and delete products in their catalogue.
 * Add/Edit flows are handled by the ProductWizard step-by-step component.
 *
 * Storage: Supabase `products` table — attributes stored as jsonb.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Edit2, Trash2, Package, AlertCircle,
} from 'lucide-react';
import { User, AppView } from './types';
import { CATEGORY_SCHEMAS } from './data/formSchema';
import { supabase } from './services/supabaseClient';

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

// ── Supabase row → CatalogueItem converter ──────────────────────────────────

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

// ── Stock metadata ────────────────────────────────────────────────────────────

const STOCK_META: Record<CatalogueItem['stock'], { label: string; tw: string }> = {
  in_stock:     { label: 'In Stock',     tw: 'text-emerald-500' },
  limited:      { label: 'Limited',      tw: 'text-amber-500' },
  out_of_stock: { label: 'Out of Stock', tw: 'text-red-500' },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface Props {
  user: User;
  theme: 'light' | 'dark';
  setView: (view: AppView) => void;
  setEditProduct?: (product: CatalogueItem | null) => void;
}

export const MerchantCatalogue: React.FC<Props> = ({ user, theme, setView, setEditProduct }) => {
  const isDark = theme === 'dark';
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [filterSchemaId, setFilterSchemaId] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    callManageProducts({ action: 'list', merchantId: user.id })
      .then(res => {
        const rows = (res.products as Record<string, unknown>[]) ?? [];
        setItems(rows.map(rowToItem));
      })
      .catch(() => {});
  }, [user.id]);

  const openAdd = () => {
    setEditProduct?.(null);
    setView('product_wizard');
  };

  const openEdit = (item: CatalogueItem) => {
    setEditProduct?.(item);
    setView('product_wizard');
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
          {items.length > 0 && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
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
    </div>
  );
};
