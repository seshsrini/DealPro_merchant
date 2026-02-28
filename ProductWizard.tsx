import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { AppView, User } from './types';
import { X, CheckCircle2, RotateCcw } from 'lucide-react';
import { getSchemaForCategory } from './data/formSchema';
import { fetchStoreCategories } from './services/categoryService';
import { ProductData } from './services/productLookupService';

// Step components
import { StepProductLookup } from './components/product-wizard/StepProductLookup';
import { StepProductImage } from './components/product-wizard/StepProductImage';
import { StepProductName } from './components/product-wizard/StepProductName';
import { StepCategory } from './components/product-wizard/StepCategory';
import { StepSpecs } from './components/product-wizard/StepSpecs';
import { StepPriceStock } from './components/product-wizard/StepPriceStock';
import { StepProductReview } from './components/product-wizard/StepProductReview';

// --- Types ---
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

type WizardAction =
  | { type: 'SET_FIELD'; field: keyof ProductWizardState; value: any }
  | { type: 'SET_SPEC'; key: string; value: string }
  | { type: 'BULK_UPDATE'; payload: Partial<ProductWizardState> }
  | { type: 'RESET' };

const initialState: ProductWizardState = {
  name: '',
  brand: '',
  imageUrl: null,
  category: '',
  schemaId: 'general',
  specs: {},
  price: '',
  mrp: '',
  stock: 'in_stock',
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
const STEP_LABELS = ['Lookup', 'Image', 'Details', 'Category', 'Specs', 'Pricing', 'Review'];
const TOTAL_STEPS = STEP_LABELS.length;

// --- Component ---
interface ProductWizardProps {
  user: User;
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
  editProduct?: {
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
  } | null;
}

export const ProductWizard: React.FC<ProductWizardProps> = ({
  user, setView, theme, editProduct,
}) => {
  const isDark = theme === 'dark';
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  // In edit mode, skip lookup step (start at step 1 = Image)
  const [currentStep, setCurrentStep] = useState(editProduct ? 1 : 0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Data
  const [categories, setCategories] = useState<string[]>([]);

  // Result state
  const [showSuccess, setShowSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const DRAFT_KEY = `product_wizard_draft_${user.id}`;

  // Load categories on mount
  useEffect(() => {
    fetchStoreCategories()
      .then(cats => setCategories(cats))
      .catch(err => console.error('[ProductWizard] Failed to load categories:', err));
  }, []);

  // Pre-populate for edit mode
  useEffect(() => {
    if (editProduct) {
      dispatch({
        type: 'BULK_UPDATE',
        payload: {
          name: editProduct.name,
          brand: editProduct.brand,
          imageUrl: editProduct.imageUrl,
          category: editProduct.category,
          schemaId: editProduct.schemaId,
          specs: { ...editProduct.specs },
          price: editProduct.price,
          mrp: editProduct.mrp,
          stock: editProduct.stock,
        },
      });
    }
  }, [editProduct]);

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
    goToStep(currentStep + 1);
  };

  const handleBack = () => {
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

  // Product lookup auto-fill
  const handleLookupResult = (product: ProductData) => {
    const detectedSchema = getSchemaForCategory(product.detectedSchemaId);
    const numericPrice = (product.specs.price ?? '').replace(/[^\d.]/g, '').replace(/\.(?=.*\.)/g, '');
    dispatch({
      type: 'BULK_UPDATE',
      payload: {
        name: product.name || state.name,
        brand: product.brand || state.brand,
        imageUrl: null, // Don't auto-set image from lookup — merchant should upload their own
        category: detectedSchema.label,
        schemaId: detectedSchema.id,
        specs: { ...state.specs, ...product.specs },
        price: numericPrice || state.price,
      },
    });
    handleNext(); // Advance past lookup
  };

  // --- Render Step ---
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepProductLookup
            hintCategory={user.category ?? ''}
            onResult={handleLookupResult}
            onSkip={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 1:
        return (
          <StepProductImage
            value={state.imageUrl}
            categoryLabel={state.category || user.category || ''}
            onChange={(url) => dispatch({ type: 'SET_FIELD', field: 'imageUrl', value: url })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 2:
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
      case 3:
        return (
          <StepCategory
            selectedCategory={state.category}
            selectedSchemaId={state.schemaId}
            categories={categories}
            onChange={(category, schemaId) => {
              dispatch({ type: 'SET_FIELD', field: 'category', value: category });
              dispatch({ type: 'SET_FIELD', field: 'schemaId', value: schemaId });
              // Clear specs when category changes
              if (schemaId !== state.schemaId) {
                dispatch({ type: 'SET_FIELD', field: 'specs', value: {} });
              }
            }}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 4:
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
      case 5:
        return (
          <StepPriceStock
            price={state.price}
            mrp={state.mrp}
            stock={state.stock}
            onPriceChange={(v) => dispatch({ type: 'SET_FIELD', field: 'price', value: v })}
            onMrpChange={(v) => dispatch({ type: 'SET_FIELD', field: 'mrp', value: v })}
            onStockChange={(v) => dispatch({ type: 'SET_FIELD', field: 'stock', value: v })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 6:
        return (
          <StepProductReview
            wizardState={state}
            user={user}
            editingId={editProduct?.id || null}
            onBack={handleBack}
            onSaveSuccess={handleSaveSuccess}
            onSaveError={handleSaveError}
            theme={theme}
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
              OK, I'll Fix It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
