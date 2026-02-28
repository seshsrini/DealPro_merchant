import React, { useEffect, useState } from 'react';
import { Eye, Loader2, CheckCircle2, Package, AlertCircle } from 'lucide-react';
import { floatIn } from './floatIn';
import { getSchemaForCategory } from '../../data/formSchema';
import { addCampaignService } from '../../services/addCampaignService';
import { supabase } from '../../services/supabaseClient';

async function callManageProducts(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-products', { body });
  if (error) throw error;
  return data as Record<string, unknown>;
}

interface ProductWizardState {
  name: string;
  brand: string;
  imageUrl: string | null;
  category: string;
  schemaId: string;
  specs: Record<string, string>;
  price: string;
  mrp: string;
  stock: 'in_stock' | 'out_of_stock' | 'limited';
}

interface StepProductReviewProps {
  wizardState: ProductWizardState;
  user: any;
  editingId: string | null;
  onBack: () => void;
  onSaveSuccess: () => void;
  onSaveError: (error: string) => void;
  theme: 'light' | 'dark';
}

const STOCK_LABELS: Record<string, { label: string; color: string }> = {
  in_stock: { label: 'In Stock', color: 'text-emerald-500' },
  limited: { label: 'Limited', color: 'text-amber-500' },
  out_of_stock: { label: 'Out of Stock', color: 'text-red-500' },
};

export const StepProductReview: React.FC<StepProductReviewProps> = ({
  wizardState, user, editingId, onBack, onSaveSuccess, onSaveError, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const schema = getSchemaForCategory(wizardState.schemaId);
  const hasDiscount = wizardState.mrp && wizardState.price &&
    parseFloat(wizardState.mrp) > parseFloat(wizardState.price);
  const discountPct = hasDiscount
    ? Math.round((1 - parseFloat(wizardState.price) / parseFloat(wizardState.mrp)) * 100)
    : 0;

  const stockMeta = STOCK_LABELS[wizardState.stock] || STOCK_LABELS.in_stock;

  const handleSave = () => {
    if (!editingId) {
      // New product — show copyright consent first
      setShowConsent(true);
    } else {
      proceedWithSave();
    }
  };

  const proceedWithSave = async () => {
    setSaving(true);
    setShowConsent(false);
    try {
      // Phase 1: Content moderation
      setProgress('Checking content...');
      const specsText = Object.values(wizardState.specs).filter(Boolean).join(' ');
      const modResult = await addCampaignService.moderateContent(
        wizardState.name, wizardState.brand, specsText
      );
      if (modResult.flagged) {
        throw new Error(modResult.reason || 'Product content violates our guidelines. Please revise.');
      }

      // Phase 2: Save product
      setProgress(editingId ? 'Updating product...' : 'Adding to catalogue...');
      const { brand, price, mrp, stock, schemaId, specs } = wizardState;
      const row = {
        name: wizardState.name,
        category: wizardState.category.slice(0, 50),
        image_url: wizardState.imageUrl,
        merchant_id: user.id,
        attributes: { brand, price, mrp, stock, schemaId, ...specs },
        is_active: true,
      };

      if (editingId) {
        await callManageProducts({
          action: 'update',
          merchantId: user.id,
          productId: editingId,
          name: row.name,
          category: row.category,
          image_url: row.image_url,
          attributes: row.attributes,
        });
      } else {
        await callManageProducts({
          action: 'insert',
          merchantId: user.id,
          name: row.name,
          category: row.category,
          image_url: row.image_url,
          attributes: row.attributes,
          merchant_consent: true,
        });
      }

      onSaveSuccess();
    } catch (err: any) {
      onSaveError(err.message || 'Failed to save product. Please try again.');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  // Spec display — only non-empty values
  const specEntries = schema.fields
    .filter(f => f.key !== 'brand' && wizardState.specs[f.key])
    .map(f => ({ label: f.label, value: wizardState.specs[f.key] }));

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
          <Eye className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Review product
        </h2>
        <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Check everything looks good before saving.
        </p>
      </div>

      {/* Product Card Preview */}
      <div style={floatIn(150, visible)} className={`rounded-2xl overflow-hidden border mb-5 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
        {/* Image */}
        <div className={`relative w-full aspect-video flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
          {wizardState.imageUrl ? (
            <img src={wizardState.imageUrl} alt={wizardState.name} className="w-full h-full object-contain" />
          ) : (
            <Package className={`w-16 h-16 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          )}
          {discountPct > 0 && (
            <span className="absolute top-3 left-3 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {discountPct}% off
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          {wizardState.brand && (
            <p className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {wizardState.brand}
            </p>
          )}
          <h3 className={`font-bold text-base mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {wizardState.name}
          </h3>
          <p className={`text-xs mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {wizardState.category}
          </p>

          {/* Price row */}
          <div className="flex items-center gap-2 mb-2">
            {wizardState.price && (
              <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                ₹{wizardState.price}
              </span>
            )}
            {hasDiscount && (
              <span className={`text-sm line-through ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                ₹{wizardState.mrp}
              </span>
            )}
          </div>

          {/* Stock */}
          <p className={`text-xs font-medium ${stockMeta.color}`}>
            {stockMeta.label}
          </p>
        </div>
      </div>

      {/* Specifications summary */}
      {specEntries.length > 0 && (
        <div style={floatIn(300, visible)} className={`rounded-2xl p-4 border mb-5 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Specifications
          </p>
          <div className="space-y-2">
            {specEntries.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
                <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {value === 'true' ? 'Yes' : value === 'false' ? 'No' : value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress overlay */}
      {progress && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 flex items-center gap-3 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{progress}</span>
          </div>
        </div>
      )}

      {/* Copyright Consent Modal */}
      {showConsent && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-6">
          <div className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
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
                onClick={() => setShowConsent(false)}
                className={`flex-1 h-12 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={proceedWithSave}
                className="flex-1 h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all"
              >
                I Agree & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save button */}
      <div style={floatIn(450, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={onBack}
          disabled={saving}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          } disabled:opacity-40`}
        >
          Back
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-[2] h-14 rounded-xl bg-emerald-500 text-white text-base font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {editingId ? 'Save Changes' : 'Add to Catalogue'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
