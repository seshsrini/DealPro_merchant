import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { AppView, User } from './types';
import { X, CheckCircle2, Loader2, RotateCcw, AlertTriangle, Bookmark } from 'lucide-react';
import { addCampaignService } from './services/addCampaignService';
import { merchantService } from './services/merchantService';
import { campaignTemplatesService } from './services/campaignTemplatesService';
import { useTranslation } from './contexts/LanguageContext';

// Reused step components from campaign-wizard
import { StepImage } from './components/campaign-wizard/StepImage';
import { StepHeading } from './components/campaign-wizard/StepHeading';
import { StepOffer } from './components/campaign-wizard/StepOffer';
import { StepDescription } from './components/campaign-wizard/StepDescription';
import { StepStoreSelect } from './components/campaign-wizard/StepStoreSelect';

// DOTD-specific steps
import { StepDotdTemplate, DotdTemplate } from './components/dotd-wizard/StepDotdTemplate';
import { StepDotdDate } from './components/dotd-wizard/StepDotdDate';
import { StepDotdReview } from './components/dotd-wizard/StepDotdReview';

// --- Types ---
interface DotdWizardState {
  dealHeading: string;
  offerValue: string;
  description: string;
  dealDate: string;
  selectedStoreId: string;
  selectedImageFile: File | null;
  existingThumbnail: string | null;
  existingImageName: string | null;
  // Multi-media: up to 5 images + 1 video
  additionalImageFiles: File[];
  additionalImageUrls: string[];
  selectedVideoFile: File | null;
  existingVideoUrl: string | null;
  imagePriceOverlays: Record<number, { discountPct: string; offerPrice: string }>;
}

type DotdAction =
  | { type: 'SET_FIELD'; field: keyof DotdWizardState; value: any }
  | { type: 'RESTORE_DRAFT'; draft: Partial<DotdWizardState> }
  | { type: 'RESET' };

const initialState: DotdWizardState = {
  dealHeading: '',
  offerValue: '',
  description: '',
  dealDate: '',
  selectedStoreId: '',
  selectedImageFile: null,
  existingThumbnail: null,
  existingImageName: null,
  additionalImageFiles: [],
  additionalImageUrls: [],
  selectedVideoFile: null,
  existingVideoUrl: null,
  imagePriceOverlays: {},
};

function dotdReducer(state: DotdWizardState, action: DotdAction): DotdWizardState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESTORE_DRAFT':
      return { ...state, ...action.draft, selectedImageFile: null, additionalImageFiles: [], selectedVideoFile: null };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// Steps: Store → Template → Image → Heading → Offer → Description → Date → Review
const STEP_LABELS = ['Store', 'Template', 'Image', 'Heading', 'Offer', 'Description', 'Date', 'Review'];
const TOTAL_STEPS = STEP_LABELS.length;

// --- Component ---
interface DotdWizardProps {
  user: User;
  setView: (view: AppView) => void;
  theme: 'light' | 'dark';
}

export const DotdWizard: React.FC<DotdWizardProps> = ({ user, setView, theme }) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(dotdReducer, initialState);
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
  const [moderationAlert, setModerationAlert] = useState<string | null>(null);

  // Save-as-template flow
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  // Field name → wizard step index
  const FIELD_TO_STEP: Record<string, number> = {
    deal_heading: 3, localized_heading: 3,
    offer_value: 4,  localized_offer: 4,
    long_description: 5, localized_description: 5,
  };

  const DRAFT_KEY = `dotd_wizard_draft_${user.id}`;

  // Load stores + image library on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const stores = await merchantService.getMerchantStores(user.id);
        setMerchantStores(stores || []);
        // Validate draft's selectedStoreId against real stores
        const storeIds = new Set((stores || []).map((s: any) => s.id).filter(Boolean));
        if (state.selectedStoreId && !storeIds.has(state.selectedStoreId)) {
          console.warn('[DotdWizard] Draft store_id not found in current stores, clearing selection');
          dispatch({ type: 'SET_FIELD', field: 'selectedStoreId', value: '' });
          setCurrentStep(0); // Force back to store selection
        }
      } catch (err) {
        console.error('[DotdWizard] Failed to load stores:', err);
      }

      try {
        setIsLibraryLoading(true);
        const images = await addCampaignService.getMerchantImages(user.id);
        const seen = new Set<string>();
        const unique = (images || []).filter((img: any) => {
          if (seen.has(img.url)) return false;
          seen.add(img.url);
          return true;
        });
        setImageLibrary(unique);
      } catch (err) {
        console.error('[DotdWizard] Failed to load images:', err);
      } finally {
        setIsLibraryLoading(false);
      }
    };
    loadData();
  }, [user.id]);

  // Restore draft
  useEffect(() => {
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
          console.log('[DotdWizard] Draft restored');
        }
      }
    } catch {}
  }, [DRAFT_KEY]);

  // Save draft
  const saveDraft = useCallback(() => {
    try {
      const { selectedImageFile, additionalImageFiles, selectedVideoFile, ...serializable } = state;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializable));
      localStorage.setItem(DRAFT_KEY + '_step', String(currentStep));
    } catch {}
  }, [DRAFT_KEY, state, currentStep]);

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
    setModerationAlert(null);
    saveDraft();
    goToStep(currentStep + 1);
  };

  const handleBack = () => {
    setModerationAlert(null);
    if (currentStep === 0) {
      setView('merchant_dashboard');
      return;
    }
    goToStep(currentStep - 1);
  };

  const handlePublishSuccess = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    // Ask if they want to save as template
    setTemplateName(state.dealHeading || '');
    setShowSaveTemplate(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      await campaignTemplatesService.saveTemplate({
        merchantId: user.id,
        templateName: templateName.trim(),
        campaignData: {
          title: state.dealHeading,
          deal_offer: state.offerValue,
          launch_date: state.dealDate,
          end_date: state.dealDate,
          category: user.category,
        },
      });
      setTemplateSaved(true);
    } catch {
      // Non-blocking
    } finally {
      setSavingTemplate(false);
    }
    setTimeout(() => {
      setShowSaveTemplate(false);
      setTemplateSaved(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setView('merchant_dashboard');
      }, 3000);
    }, 1500);
  };

  const handleSkipTemplate = () => {
    setShowSaveTemplate(false);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setView('merchant_dashboard');
    }, 3000);
  };

  const handlePublishError = (error: string) => {
    setPublishError(error);
  };

  const handleModerationBlock = (field: string, message: string) => {
    setModerationAlert(message);
    const targetStep = FIELD_TO_STEP[field];
    if (targetStep !== undefined) {
      goToStep(targetStep);
    }
  };

  const handleClose = () => {
    setView('merchant_dashboard');
  };

  const handleDiscard = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    dispatch({ type: 'RESET' });
    setCurrentStep(0);
    setShowDiscardConfirm(false);
  };

  const setField = (field: keyof DotdWizardState) => (value: any) => {
    dispatch({ type: 'SET_FIELD', field, value });
  };

  // Template selection: pre-populate heading, offer, description
  const handleTemplateSelect = (template: DotdTemplate) => {
    dispatch({ type: 'SET_FIELD', field: 'dealHeading', value: template.heading });
    dispatch({ type: 'SET_FIELD', field: 'offerValue', value: template.offer });
    dispatch({ type: 'SET_FIELD', field: 'description', value: template.description });
    handleNext();
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
          <StepDotdTemplate
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
            additionalImageFiles={state.additionalImageFiles}
            additionalImageUrls={state.additionalImageUrls}
            selectedVideoFile={state.selectedVideoFile}
            existingVideoUrl={state.existingVideoUrl}
            imageLibrary={imageLibrary}
            isLibraryLoading={isLibraryLoading}
            onFileSelected={(file) => dispatch({ type: 'SET_FIELD', field: 'selectedImageFile', value: file })}
            onExistingSelected={(url, name) => {
              dispatch({ type: 'SET_FIELD', field: 'existingThumbnail', value: url || null });
              dispatch({ type: 'SET_FIELD', field: 'existingImageName', value: name });
            }}
            onAdditionalImagesChange={(files, urls) => {
              dispatch({ type: 'SET_FIELD', field: 'additionalImageFiles', value: files });
              dispatch({ type: 'SET_FIELD', field: 'additionalImageUrls', value: urls });
            }}
            onVideoChange={(file, url) => {
              dispatch({ type: 'SET_FIELD', field: 'selectedVideoFile', value: file });
              dispatch({ type: 'SET_FIELD', field: 'existingVideoUrl', value: url });
            }}
            imagePriceOverlays={state.imagePriceOverlays}
            onPriceOverlayChange={(overlays) => dispatch({ type: 'SET_FIELD', field: 'imagePriceOverlays', value: overlays })}
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
          <StepDotdDate
            value={state.dealDate}
            onChange={setField('dealDate')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 7:
        return (
          <StepDotdReview
            wizardState={state}
            user={user}
            stores={merchantStores}
            onBack={handleBack}
            onPublishSuccess={handlePublishSuccess}
            onPublishError={handlePublishError}
            onModerationBlock={handleModerationBlock}
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
          {t('m_dotd_wizard_title')}
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
                    ? isDark ? 'bg-yellow-500' : 'bg-yellow-500'
                    : i === currentStep
                      ? isDark ? 'bg-slate-500' : 'bg-slate-400'
                      : isDark ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}

        {/* Moderation Alert Banner */}
        {moderationAlert && (
          <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 flex-1">{moderationAlert} {t('m_edit_field_hint')}</p>
            <button onClick={() => setModerationAlert(null)} className="text-red-400 hover:text-red-600 text-lg leading-none -mt-0.5">×</button>
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
              {t('m_start_over')}
            </h3>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {t('m_start_over_desc')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDiscardConfirm(false)}
                className={`flex-1 h-11 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {t('m_cancel')}
              </button>
              <button
                onClick={handleDiscard}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-semibold active:scale-[0.98] transition-all"
              >
                {t('m_discard')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Prompt */}
      {showSaveTemplate && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            {templateSaved ? (
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('m_template_saved')}
                </h3>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('m_template_reuse')}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
                    <Bookmark className="w-6 h-6 text-yellow-500" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {t('m_save_as_template')}
                    </h3>
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('m_reuse_format')}
                    </p>
                  </div>
                </div>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={t('m_template_name')}
                  maxLength={50}
                  className={`w-full h-12 px-4 rounded-xl text-sm font-medium mb-4 outline-none transition-all ${
                    isDark
                      ? 'bg-slate-800 text-white border border-slate-700 focus:border-yellow-500'
                      : 'bg-slate-50 text-slate-900 border border-slate-200 focus:border-yellow-500'
                  }`}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleSkipTemplate}
                    className={`flex-1 h-11 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {t('m_no_thanks')}
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={!templateName.trim() || savingTemplate}
                    className="flex-1 h-11 rounded-xl bg-yellow-500 text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : t('m_save')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-8 text-center ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-yellow-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('m_dotd_created')}
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('m_dotd_featured')}
            </p>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {publishError && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('m_pub_error')}
            </h3>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {publishError}
            </p>
            <button
              onClick={() => setPublishError(null)}
              className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all"
            >
              {t('m_ok_fix')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
