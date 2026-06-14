import React, { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { AppView, User } from './types';
import { X, CheckCircle2, RotateCcw } from 'lucide-react';
import { getSchemaForCategory } from './data/formSchema';

// Step components
import { StepProductStoreSelect } from './components/product-wizard/StepProductStoreSelect';
import { StepProductPhoto } from './components/product-wizard/StepProductPhoto';
import { StepProductName } from './components/product-wizard/StepProductName';
import { StepCategory } from './components/product-wizard/StepCategory';
import { StepSpecs } from './components/product-wizard/StepSpecs';
import { StepPriceStock } from './components/product-wizard/StepPriceStock';
import { StepProductReview } from './components/product-wizard/StepProductReview';
import {
  AiProductAnalysis,
  mapCategoryToSchemaId,
  mapCategoryToUniversalLabel,
} from './services/productLookupService';
import { merchantService } from './services/merchantService';

// --- Types ---
interface ProductWizardState {
  storeIds: string[];
  name: string;
  brand: string;
  imageUrl: string | null;
  // Up to 4 extra image URLs (cover + extras = 5 total).
  additionalImages: string[];
  // Optional single product video URL.
  videoUrl: string | null;
  category: string;
  schemaId: string;
  specs: Record<string, string>;
  price: string;
  mrp: string;
  // stock_count encoding (matches products.stock_count column):
  //   null  → "10+" / Available (default)
  //   0     → Out of Stock
  //   1..10 → exact remaining count
  stockCount: number | null;
}

type WizardAction =
  | { type: 'SET_FIELD'; field: keyof ProductWizardState; value: any }
  | { type: 'SET_SPEC'; key: string; value: string }
  | { type: 'BULK_UPDATE'; payload: Partial<ProductWizardState> }
  | { type: 'RESET' };

const initialState: ProductWizardState = {
  storeIds: [],
  name: '',
  brand: '',
  imageUrl: null,
  additionalImages: [],
  videoUrl: null,
  category: '',
  schemaId: 'general',
  specs: {},
  price: '',
  mrp: '',
  stockCount: null, // default = "10+" / Available
};

function wizardReducer(state: ProductWizardState, action: WizardAction): ProductWizardState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_SPEC':
      return { ...state, specs: { ...state.specs, [action.key]: action.value } };
    case 'BULK_UPDATE':
      return { ...state, ...action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// --- Step Definitions ---
// Lookup → Image → Name/Brand → Category → Specs → Price/Stock → Review
// Steps: Photo → Details → Category → Store (multi-store only) → Specs → Pricing → Review
// Single-store merchants skip the Store step entirely.
const STEP_LABELS_MULTI = ['Photo', 'Details', 'Category', 'Store', 'Specs', 'Pricing', 'Review'];
const STEP_LABELS_SINGLE = ['Photo', 'Details', 'Category', 'Specs', 'Pricing', 'Review'];

// --- Component ---
interface ProductWizardProps {
  user: User;
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
  editProduct?: {
    id: string;
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
  } | null;
}

export const ProductWizard: React.FC<ProductWizardProps> = ({
  user, setView, theme, editProduct,
}) => {
  const isDark = theme === 'dark';
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const [currentStep, setCurrentStep] = useState(0);
  // True when the merchant tapped a Review pencil to edit one section.
  // The next handleNext / save action should return them to Review instead
  // of advancing to the next step in sequence.
  const returnToReviewRef = useRef(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Merchant stores for the store-select step
  const [merchantStores, setMerchantStores] = useState<any[]>([]);
  const isMultiStore = merchantStores.length > 1;
  const STEP_LABELS = isMultiStore ? STEP_LABELS_MULTI : STEP_LABELS_SINGLE;
  const TOTAL_STEPS = STEP_LABELS.length;

  // Result state
  const [showSuccess, setShowSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const DRAFT_KEY = `product_wizard_draft_${user.id}`;

  // Load merchant stores on mount; auto-assign if single store. Force a fresh
  // fetch (bypass the 1-hour cache) so a recently-added 2nd store immediately
  // unlocks the multi-store "Select stores" step instead of auto-assigning.
  useEffect(() => {
    merchantService.getMerchantStores(user.id, true)
      .then(stores => {
        const active = (stores || []).filter((s: any) => s.active_status !== 'disabled');
        setMerchantStores(active);
        // Single store → auto-assign in background, no store selection step shown
        if (active.length === 1 && state.storeIds.length === 0) {
          dispatch({ type: 'SET_FIELD', field: 'storeIds', value: [active[0].id] });
        }
      })
      .catch(err => console.error('[ProductWizard] Failed to load stores:', err));
  }, [user.id]);

  // Pre-populate for edit mode AND jump straight to the Review step.
  // Editing an existing product shouldn't re-walk every wizard step — the
  // Review screen has pencil-edit affordances per field, which is the right
  // flow for surgical edits.
  useEffect(() => {
    if (editProduct) {
      dispatch({
        type: 'BULK_UPDATE',
        payload: {
          storeIds: editProduct.storeIds || [],
          name: editProduct.name,
          brand: editProduct.brand,
          imageUrl: editProduct.imageUrl,
          additionalImages: editProduct.additionalImages || [],
          videoUrl: editProduct.videoUrl,
          category: editProduct.category,
          schemaId: editProduct.schemaId,
          specs: { ...editProduct.specs },
          price: editProduct.price,
          mrp: editProduct.mrp,
          stockCount: editProduct.stockCount,
        },
      });
      // Review is always the last step in both single- and multi-store layouts.
      setCurrentStep(STEP_LABELS.length - 1);
    }
  }, [editProduct, STEP_LABELS.length]);

  // Restore draft for new products only
  useEffect(() => {
    if (editProduct) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && draft.name !== undefined) {
          dispatch({ type: 'BULK_UPDATE', payload: draft });
          const savedStep = localStorage.getItem(DRAFT_KEY + '_step');
          if (savedStep) {
            const step = parseInt(savedStep);
            if (step >= 0 && step < TOTAL_STEPS) setCurrentStep(step);
          }
          console.log('[ProductWizard] Draft restored');
        }
      }
    } catch {}
  }, [DRAFT_KEY, editProduct]);

  // Save draft
  const saveDraft = useCallback(() => {
    if (editProduct) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      localStorage.setItem(DRAFT_KEY + '_step', String(currentStep));
    } catch {}
  }, [DRAFT_KEY, state, currentStep, editProduct]);

  // Navigation
  const goToStep = (newStep: number) => {
    if (isTransitioning) return;
    setSlideDirection(newStep > currentStep ? 'left' : 'right');
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(newStep);
      setIsTransitioning(false);
    }, 250);
  };

  const handleNext = () => {
    saveDraft();

    // Pencil-edit return: when the merchant jumped here from Review's per-
    // section pencil, route back to Review instead of advancing to the next
    // step in sequence. Saves them from walking the rest of the wizard
    // every time they edit one field.
    if (returnToReviewRef.current) {
      returnToReviewRef.current = false;
      goToStep(STEP_LABELS.length - 1);
      return;
    }

    const nextStepName = STEP_LABELS[currentStep + 1];

    // When moving to the Store step, auto-select stores matching the chosen category
    if (nextStepName === 'Store' && isMultiStore && state.storeIds.length === 0) {
      const categoryLower = (state.category || '').toLowerCase();
      const matched = merchantStores
        .filter((s: any) => {
          const sc = (s.store_category || '').toLowerCase();
          return sc && (categoryLower.includes(sc) || sc.includes(categoryLower.split(' ')[0]));
        })
        .map((s: any) => s.id);
      // Pre-select matched stores; if no match, select all
      dispatch({
        type: 'SET_FIELD',
        field: 'storeIds',
        value: matched.length > 0 ? matched : merchantStores.map((s: any) => s.id),
      });
    }

    goToStep(currentStep + 1);
  };

  const handleBack = () => {
    // Pencil-edit return: when the merchant jumped here from Review's per-section
    // pencil, the back button must take them back to Review (the page with all
    // the pencils + data), not to the previous wizard step. Mirrors handleNext
    // above and matches CampaignWizard / DotdWizard behavior.
    if (returnToReviewRef.current) {
      returnToReviewRef.current = false;
      goToStep(STEP_LABELS.length - 1);
      return;
    }
    const firstStep = editProduct ? 1 : 0;
    if (currentStep === firstStep) {
      setView('merchant_catalogue');
      return;
    }
    goToStep(currentStep - 1);
  };

  const handleClose = () => {
    setView('merchant_catalogue');
  };

  const handleDiscard = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    dispatch({ type: 'RESET' });
    setCurrentStep(editProduct ? 1 : 0);
    setShowDiscardConfirm(false);
  };

  const handleSaveSuccess = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setView('merchant_catalogue');
    }, 3000);
  };

  const handleSaveError = (error: string) => {
    setSaveError(error);
  };

  // Photo + AI analysis result handler
  const handlePhotoResult = ({
    imageUrl,
    additionalImages,
    videoUrl,
    analysis,
  }: {
    imageUrl: string | null;
    additionalImages: string[];
    videoUrl: string | null;
    analysis: AiProductAnalysis | null;
  }) => {
    if (analysis) {
      // Map AI category to a canonical universal dropdown label + internal schema
      const universalLabel = mapCategoryToUniversalLabel(analysis.category);
      const schemaId = mapCategoryToSchemaId(analysis.category);
      const detectedSchema = getSchemaForCategory(schemaId);

      // Extract brand from suggested_attributes if present
      const brand = analysis.suggested_attributes.brand || analysis.suggested_attributes.Brand || '';

      // Build specs from suggested_attributes (excluding 'brand' which is its own field)
      const specs: Record<string, string> = {};
      for (const [k, v] of Object.entries(analysis.suggested_attributes)) {
        if (k.toLowerCase() !== 'brand' && v) {
          specs[k.toLowerCase().replace(/\s+/g, '_')] = String(v);
        }
      }
      // Save AI-generated description as a spec field (the products table also has a description column —
      // this is also persisted via the attributes jsonb for backward compat with the form schema)
      if (analysis.description) {
        specs['ai_description'] = analysis.description;
      }

      dispatch({
        type: 'BULK_UPDATE',
        payload: {
          name: analysis.product_name || state.name,
          brand: brand || state.brand,
          imageUrl: imageUrl,
          additionalImages,
          videoUrl,
          category: universalLabel || '',
          schemaId: detectedSchema.id,
          specs: { ...state.specs, ...specs },
          price: analysis.suggested_price ? String(analysis.suggested_price) : state.price,
        },
      });
    } else {
      // No AI analysis — just save the media, merchant fills the rest manually
      dispatch({
        type: 'BULK_UPDATE',
        payload: { imageUrl, additionalImages, videoUrl },
      });
    }
    handleNext();
  };

  // --- Render Step ---
  // Steps vary based on store count:
  //   Multi-store:  Photo(0) → Store(1) → Details(2) → Category(3) → Specs(4) → Pricing(5) → Review(6)
  //   Single-store: Photo(0) → Details(1) → Category(2) → Specs(3) → Pricing(4) → Review(5)
  const renderStep = () => {
    const stepName = STEP_LABELS[currentStep];
    switch (stepName) {
      case 'Photo':
        return (
          <StepProductPhoto
            onResult={handlePhotoResult}
            onSkip={handleNext}
            onBack={handleBack}
            theme={theme}
            initialImageUrl={state.imageUrl}
            initialAdditionalImages={state.additionalImages}
            initialVideoUrl={state.videoUrl}
          />
        );
      case 'Store':
        return (
          <StepProductStoreSelect
            stores={merchantStores}
            selectedStoreIds={state.storeIds}
            onChange={(ids) => dispatch({ type: 'SET_FIELD', field: 'storeIds', value: ids })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'Details':
        return (
          <StepProductName
            name={state.name}
            brand={state.brand}
            onNameChange={(v) => dispatch({ type: 'SET_FIELD', field: 'name', value: v })}
            onBrandChange={(v) => dispatch({ type: 'SET_FIELD', field: 'brand', value: v })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'Category':
        return (
          <StepCategory
            selectedCategory={state.category}
            selectedSchemaId={state.schemaId}
            onChange={(category, schemaId) => {
              dispatch({ type: 'SET_FIELD', field: 'category', value: category });
              dispatch({ type: 'SET_FIELD', field: 'schemaId', value: schemaId });
              if (schemaId !== state.schemaId) {
                dispatch({ type: 'SET_FIELD', field: 'specs', value: {} });
              }
            }}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'Specs':
        return (
          <StepSpecs
            schemaId={state.schemaId}
            specs={state.specs}
            onSpecChange={(key, value) => dispatch({ type: 'SET_SPEC', key, value })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'Pricing':
        return (
          <StepPriceStock
            price={state.price}
            mrp={state.mrp}
            stock={state.stockCount}
            onPriceChange={(v) => dispatch({ type: 'SET_FIELD', field: 'price', value: v })}
            onMrpChange={(v) => dispatch({ type: 'SET_FIELD', field: 'mrp', value: v })}
            onStockChange={(v) => dispatch({ type: 'SET_FIELD', field: 'stockCount', value: v })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'Review':
        return (
          <StepProductReview
            wizardState={state}
            user={user}
            editingId={editProduct?.id || null}
            onBack={handleBack}
            onSaveSuccess={handleSaveSuccess}
            onSaveError={handleSaveError}
            theme={theme}
            isMultiStore={isMultiStore}
            onEditStep={(stepName) => {
              // Pencil-edit jump: go to the requested step and remember to
              // route 'Continue' back to Review when the merchant finishes.
              const idx = STEP_LABELS.indexOf(stepName);
              if (idx >= 0) {
                returnToReviewRef.current = true;
                goToStep(idx);
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button
          onClick={handleClose}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
            isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200'
          }`}
        >
          <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        </button>
        <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {editProduct ? 'Edit Product' : 'New Product'}
        </span>
        <button
          onClick={() => setShowDiscardConfirm(true)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
            isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200'
          }`}
          title="Start over"
        >
          <RotateCcw className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        </button>
      </div>

      {/* Floating card */}
      <div className={`flex-1 flex flex-col mx-3 mt-1 mb-1 rounded-2xl shadow-lg overflow-hidden ${
        isDark ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Progress Bar (hide on Review step) */}
        {currentStep < TOTAL_STEPS - 1 && (
          <div className="w-full flex items-center gap-1.5 px-5 pt-3 pb-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
                  i < currentStep
                    ? 'bg-emerald-500'
                    : i === currentStep
                      ? isDark ? 'bg-slate-500' : 'bg-slate-400'
                      : isDark ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}

        {/* Step Content with Slide Transitions */}
        <div className="flex-1 overflow-y-auto relative">
          <div className={`min-h-full flex flex-col transition-all duration-250 ease-in-out ${
            isTransitioning
              ? slideDirection === 'left' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0'
              : 'translate-x-0 opacity-100'
          }`}>
            {renderStep()}
          </div>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Start over?
            </h3>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              This will clear all your progress and start from scratch.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className={`flex-1 h-11 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDiscard}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-semibold active:scale-[0.98] transition-all"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-8 text-center ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {editProduct ? 'Product Updated!' : 'Product Added!'}
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Your product catalogue has been updated.
            </p>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {saveError && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Save Error
            </h3>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {saveError}
            </p>
            <button
              onClick={() => setSaveError(null)}
              className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all"
            >
              Error occurred. Please close and open the app and try again.
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
