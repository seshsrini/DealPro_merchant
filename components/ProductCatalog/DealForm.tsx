/**
 * DealForm.tsx
 * Full-screen slide-up panel for product-backed deal entry.
 *
 * Flow:
 *  1. Merchant searches / scans a product  (ProductLookup)
 *  2. Category-specific dynamic fields render (formSchema)
 *  3. Merchant fills incentive value + deal dates
 *  4. "Apply to Deal" passes a DealEntry payload to the parent
 *
 * The parent (MerchantMyCampaigns) uses DealEntry to pre-fill
 * its existing campaign creation form fields.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Package, ChevronDown, Image as ImageIcon,
  CalendarDays, Tag, AlignLeft, ExternalLink, Loader2
} from 'lucide-react';
import { ProductLookup } from './ProductLookup';
import { ProductData } from '../../services/productLookupService';
import { CATEGORY_SCHEMAS, getSchemaForCategory, FieldDefinition, CategorySchema } from '../../data/formSchema';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DealEntry {
  /** Product name → becomes the campaign headline */
  productName: string;
  /** External image URL from open API — no upload required */
  imageUrl: string | null;
  /** Category schema ID */
  categoryId: string;
  /** Category-specific field values */
  specs: Record<string, string>;
  /** Incentive / offer value e.g. "30% OFF", "Buy 2 Get 1" */
  offerValue: string;
  /** Deal description composed from product specs */
  description: string;
  /** ISO date strings */
  startDate: string;
  endDate: string;
}

interface DealFormProps {
  /** Merchant's profile category — used to pre-select schema */
  merchantCategory: string;
  theme: 'light' | 'dark';
  onApply: (entry: DealEntry) => void;
  onClose: () => void;
}

// ── Helper: render one dynamic field ────────────────────────────────────────

const DynamicField: React.FC<{
  field: FieldDefinition;
  value: string;
  onChange: (val: string) => void;
  isDark: boolean;
}> = ({ field, value, onChange, isDark }) => {
  const inputClass = `w-full h-11 px-4 rounded-lg text-sm outline-none transition-all ${
    isDark
      ? 'bg-slate-800 text-white border border-slate-700 focus:border-slate-500'
      : 'bg-slate-50 text-slate-900 border border-slate-200 focus:border-slate-400'
  }`;

  if (field.type === 'select') {
    return (
      <select className={inputClass} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Select {field.label}...</option>
        {(field.options ?? []).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        rows={3}
        className={`w-full px-4 py-3 rounded-lg text-sm outline-none transition-all resize-none ${
          isDark
            ? 'bg-slate-800 text-white border border-slate-700 focus:border-slate-500'
            : 'bg-slate-50 text-slate-900 border border-slate-200 focus:border-slate-400'
        }`}
        placeholder={field.placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value === 'true' ? 'false' : 'true')}
          className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
            value === 'true' ? 'bg-green-500' : isDark ? 'bg-slate-700' : 'bg-slate-300'
          }`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
            value === 'true' ? 'left-[calc(100%-22px)]' : 'left-0.5'
          }`} />
        </button>
        <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
          {value === 'true' ? 'Yes' : 'No'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        className={`${inputClass} ${field.unit ? 'pr-14' : ''}`}
        placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}...`}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={field.required}
      />
      {field.unit && (
        <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium pointer-events-none ${
          isDark ? 'text-slate-500' : 'text-slate-400'
        }`}>
          {field.unit}
        </span>
      )}
    </div>
  );
};

// ── Helper: compose a description from spec values ────────────────────────────

function buildDescription(schema: CategorySchema, specs: Record<string, string>, productName: string): string {
  const lines: string[] = [];
  if (productName) lines.push(productName);
  schema.fields.forEach(f => {
    const val = specs[f.key];
    if (val && val !== 'false' && val.trim()) {
      lines.push(`${f.label}: ${val}${f.unit ? ' ' + f.unit : ''}`);
    }
  });
  return lines.join('\n');
}

// ── Main Component ────────────────────────────────────────────────────────────

export const DealForm: React.FC<DealFormProps> = ({ merchantCategory, theme, onApply, onClose }) => {
  const isDark = theme === 'dark';
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const inputClass = `w-full h-11 px-4 rounded-lg text-sm outline-none transition-all ${
    isDark
      ? 'bg-slate-800 text-white border border-slate-700 focus:border-slate-500'
      : 'bg-slate-50 text-slate-900 border border-slate-200 focus:border-slate-400'
  }`;

  // Product state
  const [product, setProduct] = useState<ProductData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Schema selection
  const [schema, setSchema] = useState<CategorySchema>(() => getSchemaForCategory(merchantCategory));
  const [showSchemaPicker, setShowSchemaPicker] = useState(false);

  // Dynamic field values (keyed by FieldDefinition.key)
  const [specs, setSpecs] = useState<Record<string, string>>({});

  // Deal fields
  const [offerValue, setOfferValue] = useState('');
  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState('');
  const [productName, setProductName] = useState('');

  // When a product is found via lookup, populate everything
  useEffect(() => {
    if (!product) return;
    setProductName(product.name);
    setImagePreview(product.imageUrl);
    // Switch schema to match detected category
    const detected = CATEGORY_SCHEMAS.find(s => s.id === product.detectedSchemaId);
    if (detected) setSchema(detected);
    // Pre-fill specs from API response
    const initial: Record<string, string> = {};
    // Fill fields that have an apiFieldMap
    const targetSchema = detected ?? schema;
    targetSchema.fields.forEach(f => {
      if (f.apiFieldMap && product.specs[f.apiFieldMap]) {
        initial[f.key] = product.specs[f.apiFieldMap];
      } else if (product.specs[f.key]) {
        initial[f.key] = product.specs[f.key];
      }
    });
    setSpecs(initial);
  }, [product]);

  // When schema changes, keep existing spec values that still apply
  const handleSchemaChange = (s: CategorySchema) => {
    setSchema(s);
    setShowSchemaPicker(false);
    // Retain values for keys that exist in new schema
    const carried: Record<string, string> = {};
    s.fields.forEach(f => {
      if (specs[f.key]) carried[f.key] = specs[f.key];
    });
    setSpecs(carried);
  };

  const handleSpecChange = (key: string, value: string) => {
    setSpecs(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    const description = buildDescription(schema, specs, productName);
    onApply({
      productName,
      imageUrl: imagePreview,
      categoryId: schema.id,
      specs,
      offerValue,
      description,
      startDate,
      endDate,
    });
  };

  const canApply = productName.trim() && offerValue.trim() && startDate && endDate;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel — slides up from bottom */}
      <div className={`relative mt-auto w-full max-h-[95dvh] flex flex-col rounded-t-2xl overflow-hidden ${
        isDark ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className={`w-12 h-1 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4 shrink-0">
          <div>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Product Catalog
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Import product data to speed up deal creation
            </p>
          </div>
          <button type="button" onClick={onClose} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-[0.98] ${isDark ? 'bg-slate-800 border border-slate-700 text-white' : 'bg-slate-100 border border-slate-200 text-slate-800'}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-6">

          {/* 1 · Product Lookup */}
          <section className="space-y-2">
            <SectionLabel icon={<Package className="w-3 h-3" />} label="Find Product" isDark={isDark} />
            <ProductLookup
              hintCategory={merchantCategory}
              onResult={setProduct}
              theme={theme}
            />
          </section>

          {/* 2 · Product Image Preview (external URL) */}
          {imagePreview && (
            <section className="space-y-2">
              <SectionLabel icon={<ImageIcon className="w-3 h-3" />} label="Product Image" isDark={isDark} />
              <div className={`flex items-center gap-4 p-3 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <img src={imagePreview} alt="product" className="w-16 h-16 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={`text-[9px] font-medium flex items-center gap-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    <ExternalLink className="w-2.5 h-2.5" /> External URL — no storage cost
                  </p>
                  <p className={`text-[9px] mt-1 truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{imagePreview}</p>
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="text-[9px] text-rose-400 hover:text-rose-300 mt-1 font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* 3 · Product Name (editable) */}
          <section className="space-y-2">
            <SectionLabel icon={<Tag className="w-3 h-3" />} label="Product / Deal Title" isDark={isDark} />
            <input
              type="text"
              className={inputClass}
              placeholder="Product name (becomes the campaign headline)"
              value={productName}
              onChange={e => setProductName(e.target.value.slice(0, 50))}
              maxLength={50}
            />
            <p className={`text-right text-[9px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{productName.length}/50</p>
          </section>

          {/* 4 · Category Schema Picker */}
          <section className="space-y-2">
            <SectionLabel icon={<ChevronDown className="w-3 h-3" />} label="Product Category" isDark={isDark} />
            <button
              type="button"
              onClick={() => setShowSchemaPicker(v => !v)}
              className={`w-full flex items-center justify-between px-4 h-11 rounded-lg border transition-all ${
                isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <span className="text-sm font-medium">{schema.label}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showSchemaPicker ? 'rotate-180' : ''}`} />
            </button>
            {showSchemaPicker && (
              <div className={`rounded-lg border overflow-hidden ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                {CATEGORY_SCHEMAS.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSchemaChange(s)}
                    className={`w-full text-left px-4 py-3 text-xs font-medium transition-colors border-b last:border-b-0 ${
                      s.id === schema.id
                        ? 'bg-green-500/15 text-green-500 border-green-500/10'
                        : isDark
                          ? 'text-slate-300 border-slate-700 hover:bg-slate-800'
                          : 'text-slate-700 border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 5 · Dynamic Category Fields */}
          {schema.fields.length > 0 && (
            <section className="space-y-4">
              <SectionLabel icon={<AlignLeft className="w-3 h-3" />} label="Product Specifications" isDark={isDark} />
              <div className="space-y-4">
                {schema.fields.map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <label className={`text-[10px] font-medium px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {field.label}{field.required && <span className="text-rose-400 ml-1">*</span>}
                    </label>
                    <DynamicField
                      field={field}
                      value={specs[field.key] ?? ''}
                      onChange={val => handleSpecChange(field.key, val)}
                      isDark={isDark}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 6 · Offer / Incentive Value */}
          <section className="space-y-2">
            <SectionLabel icon={<Tag className="w-3 h-3" />} label="Offer / Incentive" isDark={isDark} />
            <input
              type="text"
              className={inputClass}
              placeholder='e.g. "30% OFF", "Buy 2 Get 1 Free", "₹100 Cashback"'
              value={offerValue}
              onChange={e => setOfferValue(e.target.value.slice(0, 50))}
              maxLength={50}
              required
            />
          </section>

          {/* 7 · Deal Duration */}
          <section className="space-y-2">
            <SectionLabel icon={<CalendarDays className="w-3 h-3" />} label="Deal Duration" isDark={isDark} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={`text-[10px] font-medium px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Start Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={startDate}
                  min={tomorrow}
                  onChange={e => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className={`text-[10px] font-medium px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>End Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={endDate}
                  min={startDate || tomorrow}
                  onChange={e => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </section>
        </div>

        {/* Sticky Apply Footer */}
        <div className={`shrink-0 px-6 py-4 border-t ${isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className={`w-full h-12 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
              isDark ? 'bg-slate-800 text-white border border-slate-700' : 'bg-slate-900 text-white'
            }`}
          >
            Apply to Deal Form
          </button>
          {!canApply && (
            <p className={`text-[9px] text-center mt-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Add product name, offer value and dates to continue
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Small helper component ────────────────────────────────────────────────────

const SectionLabel: React.FC<{ icon: React.ReactNode; label: string; isDark: boolean }> = ({ icon, label, isDark }) => (
  <div className="flex items-center gap-2">
    <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>{icon}</span>
    <span className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
  </div>
);
