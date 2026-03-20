import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { AppView, Deal, User } from './types';
import { X, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { addCampaignService } from './services/addCampaignService';
import { merchantService } from './services/merchantService';
import { campaignTemplatesService, CampaignTemplate } from './services/campaignTemplatesService';

// Step components
import { StepTemplate } from './components/campaign-wizard/StepTemplate';
import { StepImage } from './components/campaign-wizard/StepImage';
import { StepHeading } from './components/campaign-wizard/StepHeading';
import { StepOffer } from './components/campaign-wizard/StepOffer';
import { StepDescription } from './components/campaign-wizard/StepDescription';
import { StepStoreSelect } from './components/campaign-wizard/StepStoreSelect';
import { StepStartDate } from './components/campaign-wizard/StepStartDate';
import { StepEndDate } from './components/campaign-wizard/StepEndDate';
import { StepReview } from './components/campaign-wizard/StepReview';

// --- Types ---
interface WizardState {
  dealHeading: string;
  offerValue: string;
  description: string;
  startDate: string;
  endDate: string;
  selectedStoreId: string;
  selectedImageFile: File | null;
  existingThumbnail: string | null;
  existingImageName: string | null;
}

type WizardAction =
  | { type: 'SET_FIELD'; field: keyof WizardState; value: any }
  | { type: 'RESTORE_DRAFT'; draft: Partial<WizardState> }
  | { type: 'RESET' };

const initialState: WizardState = {
  dealHeading: '',
  offerValue: '',
  description: '',
  startDate: '',
  endDate: '',
  selectedStoreId: '',
  selectedImageFile: null,
  existingThumbnail: null,
  existingImageName: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESTORE_DRAFT':
      return { ...state, ...action.draft, selectedImageFile: null }; // File can't be serialized
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// --- Step Definitions ---
const STEP_LABELS = ['Store', 'Template', 'Image', 'Heading', 'Offer', 'Description', 'Start', 'End', 'Review'];
const TOTAL_STEPS = STEP_LABELS.length;

// --- Component ---
interface CampaignWizardProps {
  user: User;
  deals: Deal[];
  editDealId?: string | null;
  setView: (view: AppView) => void;
  refreshDeals: () => Promise<void>;
  theme: 'light' | 'dark';
}

export const CampaignWizard: React.FC<CampaignWizardProps> = ({
  user, deals, editDealId, setView, refreshDeals, theme,
}) => {
  const isDark = theme === 'dark';
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Data
  const [merchantStores, setMerchantStores] = useState<any[]>([]);
  const [imageLibrary, setImageLibrary] = useState<{ url: string; name?: string }[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);

  // Result state
  const [showSuccess, setShowSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const DRAFT_KEY = `campaign_wizard_draft_${user.id}`;

  // Load stores + image library on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const stores = await merchantService.getMerchantStores(user.id);
        setMerchantStores(stores || []);
        // Validate draft's selectedStoreId against real stores
        const storeIds = new Set((stores || []).map((s: any) => s.id).filter(Boolean));
        if (state.selectedStoreId && !storeIds.has(state.selectedStoreId)) {
          console.warn('[CampaignWizard] Draft store_id not found in current stores, clearing selection');
          dispatch({ type: 'SET_FIELD', field: 'selectedStoreId', value: '' });
          setCurrentStep(0); // Force back to store selection
        }
      } catch (err) {
        console.error('[CampaignWizard] Failed to load stores:', err);
      }

      try {
        setIsLibraryLoading(true);
        const images = await addCampaignService.getMerchantImages(user.id);
        // Deduplicate by URL
        const seen = new Set<string>();
        const unique = (images || []).filter((img: any) => {
          if (seen.has(img.url)) return false;
          seen.add(img.url);
          return true;
        });
        setImageLibrary(unique);
      } catch (err) {
        console.error('[CampaignWizard] Failed to load images:', err);
      } finally {
        setIsLibraryLoading(false);
      }
    };
    loadData();
  }, [user.id]);

  // Pre-populate for edit mode
  useEffect(() => {
    if (editDealId && deals.length > 0) {
      const deal = deals.find(d => d.campaign_id === editDealId);
      if (deal) {
        dispatch({
          type: 'RESTORE_DRAFT',
          draft: {
            dealHeading: deal.deal_heading || '',
            offerValue: deal.offerValue || (deal as any).offer_value || '',
            description: deal.longDescription || (deal as any).long_description || '',
            startDate: deal.start_date ? deal.start_date.split('T')[0] : '',
            endDate: deal.end_date ? deal.end_date.split('T')[0] : '',
            selectedStoreId: deal.store_id || '',
            existingThumbnail: deal.thumbnail || (deal as any).image_url || null,
            existingImageName: deal.image_name || null,
          },
        });
        console.log('[CampaignWizard] Pre-populated from deal:', editDealId);
      }
    }
  }, [editDealId, deals]);

  // Restore draft for new campaigns only
  useEffect(() => {
    if (editDealId) return; // Don't restore draft when editing
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && draft.dealHeading !== undefined) {
          dispatch({ type: 'RESTORE_DRAFT', draft });
          const savedStep = localStorage.getItem(DRAFT_KEY + '_step');
          if (savedStep) {
            const step = parseInt(savedStep);
            if (step >= 0 && step < TOTAL_STEPS) setCurrentStep(step);
          }
          console.log('[CampaignWizard] Draft restored');
        }
      }
    } catch {}
  }, [DRAFT_KEY, editDealId]);

  // Save draft
  const saveDraft = useCallback(() => {
    if (editDealId) return; // Don't save draft when editing
    try {
      const { selectedImageFile, ...serializable } = state;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializable));
      localStorage.setItem(DRAFT_KEY + '_step', String(currentStep));
    } catch {}
  }, [DRAFT_KEY, state, currentStep, editDealId]);

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
    // In edit mode, skip Template step (step 1) going forward from Store (step 0)
    const nextStep = (editDealId && currentStep === 0) ? 2 : currentStep + 1;
    goToStep(nextStep);
  };

  const handleBack = () => {
    if (currentStep === 0) {
      setView('merchant_deals');
      return;
    }
    // In edit mode, skip Template step (step 1) going back from Image (step 2)
    const prevStep = (editDealId && currentStep === 2) ? 0 : currentStep - 1;
    goToStep(prevStep);
  };

  const handlePublishSuccess = async () => {
    // Clear draft
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    setShowSuccess(true);
    await refreshDeals();
    setTimeout(() => {
      setShowSuccess(false);
      setView('merchant_deals');
    }, 3000);
  };

  const handlePublishError = (error: string) => {
    setPublishError(error);
  };

  const handleClose = () => {
    setView('merchant_deals');
  };

  const handleDiscard = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    dispatch({ type: 'RESET' });
    setCurrentStep(0);
    setShowDiscardConfirm(false);
  };

  // Field updater helper
  const setField = (field: keyof WizardState) => (value: any) => {
    dispatch({ type: 'SET_FIELD', field, value });
  };

  // Template selection handler - pre-populates wizard fields and advances
  const handleTemplateSelect = (template: CampaignTemplate) => {
    const applied = campaignTemplatesService.applyTemplate(template);
    dispatch({ type: 'SET_FIELD', field: 'dealHeading', value: applied.title });
    dispatch({ type: 'SET_FIELD', field: 'offerValue', value: applied.dealOffer });
    dispatch({ type: 'SET_FIELD', field: 'description', value: applied.description });
    dispatch({ type: 'SET_FIELD', field: 'startDate', value: applied.launchDate.split('T')[0] });
    dispatch({ type: 'SET_FIELD', field: 'endDate', value: applied.endDate.split('T')[0] });
    handleNext(); // Move to Image step
  };

  // --- Render Step ---
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepStoreSelect
            stores={merchantStores}
            selectedStoreId={state.selectedStoreId}
            onChange={setField('selectedStoreId')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 1:
        return (
          <StepTemplate
            merchantId={user.id}
            onSelectTemplate={handleTemplateSelect}
            onSkip={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 2:
        return (
          <StepImage
            selectedFile={state.selectedImageFile}
            existingThumbnail={state.existingThumbnail}
            imageLibrary={imageLibrary}
            isLibraryLoading={isLibraryLoading}
            onFileSelected={(file) => dispatch({ type: 'SET_FIELD', field: 'selectedImageFile', value: file })}
            onExistingSelected={(url, name) => {
              dispatch({ type: 'SET_FIELD', field: 'existingThumbnail', value: url || null });
              dispatch({ type: 'SET_FIELD', field: 'existingImageName', value: name });
            }}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 3:
        return (
          <StepHeading
            value={state.dealHeading}
            onChange={setField('dealHeading')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 4:
        return (
          <StepOffer
            value={state.offerValue}
            onChange={setField('offerValue')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 5:
        return (
          <StepDescription
            value={state.description}
            onChange={setField('description')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 6:
        return (
          <StepStartDate
            value={state.startDate}
            onChange={setField('startDate')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 7:
        return (
          <StepEndDate
            value={state.endDate}
            startDate={state.startDate}
            onChange={setField('endDate')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 8:
        return (
          <StepReview
            wizardState={state}
            user={user}
            stores={merchantStores}
            editingDealId={editDealId || null}
            onBack={handleBack}
            onPublishSuccess={handlePublishSuccess}
            onPublishError={handlePublishError}
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
        <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {editDealId ? 'Edit Campaign' : 'New Campaign'}
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
                    ? isDark ? 'bg-white' : 'bg-slate-900'
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
              {editDealId ? 'Campaign Updated!' : 'Campaign Published!'}
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Your deal is now live and visible to customers.
            </p>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {publishError && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Publication Error
            </h3>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {publishError}
            </p>
            <button
              onClick={() => setPublishError(null)}
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
