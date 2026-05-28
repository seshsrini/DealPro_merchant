import React, { useEffect, useState } from 'react';
import { Eye, Loader2, CheckCircle2, Package, AlertCircle, Pencil, ImageIcon, Tag, Layers, IndianRupee, Sliders, Store } from 'lucide-react';
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
  storeIds: string[];
  name: string;
  brand: string;
  imageUrl: string | null;
  additionalImages: string[];
  videoUrl: string | null;
  category: string;
  schemaId: string;
  specs: Record<string, string>;
  price: string;
  mrp: string;
  stockCount: number | null;
}

interface StepProductReviewProps {
  wizardState: ProductWizardState;
  user: any;
  editingId: string | null;
  onBack: () => void;
  onSaveSuccess: () => void;
  onSaveError: (error: string) => void;
  theme: 'light' | 'dark';
  /** Pencil-edit jump per section. Receives the step name; the parent maps
   *  it to a step index. Optional — old callers without per-section edits
   *  still work, the pencils just won't render. */
  onEditStep?: (stepName: 'Photo' | 'Details' | 'Category' | 'Store' | 'Specs' | 'Pricing') => void;
  /** True if the merchant has more than one store, so the Store section is shown. */
  isMultiStore?: boolean;
}

// Reusable section card with a pencil-edit affordance, mirroring the
// merchant-onboarding StepReviewDetails ReviewCard pattern. Edit pencil only
// renders when onEdit is provided.
const ReviewSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  onEdit?: () => void;
  isDark: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ title, icon, onEdit, isDark, style, children }) => (
  <div
    style={style}
    className={`rounded-2xl border mb-4 overflow-hidden ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
  >
    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-slate-700/60 bg-slate-800/60' : 'border-slate-100 bg-slate-50/60'}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{title}</h3>
      </div>
      {onEdit && (
        <button
          onClick={onEdit}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}
          aria-label={`Edit ${title}`}
        >
          <Pencil className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        </button>
      )}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

function describeStock(count: number | null): { label: string; color: string } {
  if (count === null) return { label: 'Available',            color: 'text-emerald-500' };
  if (count === 0)    return { label: 'Out of Stock',         color: 'text-red-500' };
  return                     { label: `Only ${count} left`,   color: 'text-red-500' };
}

export const StepProductReview: React.FC<StepProductReviewProps> = ({
  wizardState, user, editingId, onBack, onSaveSuccess, onSaveError, theme, onEditStep, isMultiStore = false,
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

  const stockMeta = describeStock(wizardState.stockCount);

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
      const { brand, price, mrp, stockCount, schemaId, specs, additionalImages, videoUrl } = wizardState;

      // Extract AI-generated description (saved as a spec by the photo step)
      // and pass it as a top-level field. Strip it from specs to avoid duplication.
      const { ai_description, ...remainingSpecs } = specs as Record<string, string>;
      const description = ai_description || undefined;

      // stock is no longer nested in attributes — it's now its own column.
      const row = {
        name: wizardState.name,
        category: wizardState.category.slice(0, 50),
        image_url: wizardState.imageUrl,
        additional_images: additionalImages,
        video_url: videoUrl,
        merchant_id: user.id,
        attributes: { brand, price, mrp, schemaId, ...remainingSpecs },
        description,
        stock_count: stockCount,
        store_ids: wizardState.storeIds,
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
          additional_images: row.additional_images,
          video_url: row.video_url,
          attributes: row.attributes,
          description: row.description,
          stock_count: row.stock_count,
          store_ids: row.store_ids,
        });
      } else {
        await callManageProducts({
          action: 'insert',
          merchantId: user.id,
          name: row.name,
          category: row.category,
          image_url: row.image_url,
          additional_images: row.additional_images,
          video_url: row.video_url,
          attributes: row.attributes,
          description: row.description,
          stock_count: row.stock_count,
          store_ids: row.store_ids,
          merchant_consent: true,
        });
      }

      onSaveSuccess();
    } catch (err: any) {
      onSaveError('Unable to save product. Please try again.');
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

      {/* Photo */}
      <ReviewSection
        title="Photo"
        icon={<ImageIcon className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
        onEdit={onEditStep ? () => onEditStep('Photo') : undefined}
        isDark={isDark}
        style={floatIn(150, visible)}
      >
        <div className={`relative w-full aspect-video rounded-lg overflow-hidden flex items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
          {wizardState.imageUrl ? (
            <img src={wizardState.imageUrl} alt={wizardState.name} className="w-full h-full object-contain" />
          ) : (
            <Package className={`w-12 h-12 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
          )}
          {discountPct > 0 && (
            <span className="absolute top-2 left-2 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{discountPct}% off</span>
          )}
        </div>
      </ReviewSection>

      {/* Details (name + brand) */}
      <ReviewSection
        title="Details"
        icon={<Tag className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
        onEdit={onEditStep ? () => onEditStep('Details') : undefined}
        isDark={isDark}
        style={floatIn(200, visible)}
      >
        {wizardState.brand && (
          <p className={`text-[10px] font-medium mb-0.5 uppercase tracking-wide ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{wizardState.brand}</p>
        )}
        <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>{wizardState.name}</h3>
      </ReviewSection>

      {/* Category */}
      <ReviewSection
        title="Category"
        icon={<Layers className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
        onEdit={onEditStep ? () => onEditStep('Category') : undefined}
        isDark={isDark}
        style={floatIn(250, visible)}
      >
        <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{wizardState.category || '—'}</p>
      </ReviewSection>

      {/* Store (multi-store only) */}
      {isMultiStore && (
        <ReviewSection
          title="Store"
          icon={<Store className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
          onEdit={onEditStep ? () => onEditStep('Store') : undefined}
          isDark={isDark}
          style={floatIn(280, visible)}
        >
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            {(wizardState.storeIds || []).length > 0 ? `${wizardState.storeIds.length} store${wizardState.storeIds.length === 1 ? '' : 's'} selected` : 'No stores selected'}
          </p>
        </ReviewSection>
      )}

      {/* Specifications */}
      {specEntries.length > 0 && (
        <ReviewSection
          title="Specifications"
          icon={<Sliders className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
          onEdit={onEditStep ? () => onEditStep('Specs') : undefined}
          isDark={isDark}
          style={floatIn(300, visible)}
        >
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
        </ReviewSection>
      )}

      {/* Pricing & Stock */}
      <ReviewSection
        title="Pricing"
        icon={<IndianRupee className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />}
        onEdit={onEditStep ? () => onEditStep('Pricing') : undefined}
        isDark={isDark}
        style={floatIn(350, visible)}
      >
        <div className="flex items-center gap-2 mb-2">
          {wizardState.price && (
            <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{wizardState.price}</span>
          )}
          {hasDiscount && (
            <span className={`text-sm line-through ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>₹{wizardState.mrp}</span>
          )}
        </div>
        <p className={`text-xs font-medium ${stockMeta.color}`}>{stockMeta.label}</p>
      </ReviewSection>

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

      {/* Save button. Back button is hidden in edit mode — editing jumps
          straight to Review and uses per-section pencil edits, so there's
          no previous step to go back to. The header X still closes. */}
      <div style={floatIn(450, visible)} className="mt-auto pb-8 flex gap-3">
        {!editingId && (
          <button
            onClick={onBack}
            disabled={saving}
            className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            } disabled:opacity-40`}
          >
            Back
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`${editingId ? 'w-full' : 'flex-[2]'} h-14 rounded-xl bg-emerald-500 text-white text-base font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
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
