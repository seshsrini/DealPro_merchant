import React, { useState, useEffect, useReducer, useCallback, useMemo, useRef } from 'react';
import { AppView, User } from './types';
import { X, CheckCircle2, Loader2, RotateCcw, AlertTriangle, Bookmark } from 'lucide-react';
import { addCampaignService } from './services/addCampaignService';
import { merchantService } from './services/merchantService';
import { supabase } from './services/supabaseClient';
import { campaignDraftService, CampaignDraftKind } from './services/draftService';
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
import { StepTrustBadges } from './components/campaign-wizard/StepTrustBadges';
import { StepBuyGetFree, FreeGiftItem, emptyGift } from './components/campaign-wizard/StepBuyGetFree';
import { StepBannerPlacement } from './components/campaign-wizard/StepBannerPlacement';

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
  trustBadgeIds: string[];
  freeGifts: FreeGiftItem[];
  originalImageFile: File | null;
  bannerPlacement: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'none';
  // Stable idempotency key for this in-flight DOTD (persisted in the draft) so a
  // re-publish after an error / close-reopen dedupes instead of duplicating.
  clientDedupKey: string;
}

type DotdAction =
  | { type: 'SET_FIELD'; field: keyof DotdWizardState; value: any }
  | { type: 'RESTORE_DRAFT'; draft: Partial<DotdWizardState> }
  | { type: 'RESET' };

// Generates a stable per-deal idempotency key — a temporary unique ID for the
// in-flight publish, reused across retries so a re-published DOTD dedupes.
function makeDedupKey(): string {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `dk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
  trustBadgeIds: [],
  freeGifts: [],
  originalImageFile: null,
  bannerPlacement: 'auto',
  clientDedupKey: '',
};

function dotdReducer(state: DotdWizardState, action: DotdAction): DotdWizardState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESTORE_DRAFT':
      return {
        ...state,
        ...action.draft,
        selectedImageFile: null,
        additionalImageFiles: [],
        selectedVideoFile: null,
        originalImageFile: null,
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// --- Step sequences ---
type StepKind = 'store' | 'template' | 'image' | 'freeGifts' | 'heading' | 'offer' | 'description' | 'badges' | 'bannerPlacement' | 'date' | 'review';

const NORMAL_STEPS: StepKind[] = ['store', 'template', 'image', 'heading', 'offer', 'description', 'badges', 'bannerPlacement', 'date', 'review'];
const BUY_GET_FREE_STEPS: StepKind[] = ['store', 'template', 'image', 'freeGifts', 'heading', 'offer', 'description', 'badges', 'bannerPlacement', 'date', 'review'];

const NORMAL_LABELS = ['Store', 'Template', 'Image', 'Heading', 'Offer', 'Description', 'Badges', 'Layout', 'Date', 'Review'];
const BUY_GET_FREE_LABELS = ['Store', 'Template', 'Image', 'Gifts', 'Heading', 'Offer', 'Description', 'Badges', 'Layout', 'Date', 'Review'];

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

  // Assign this draft a stable idempotency key the first time it's needed. It rides
  // along in the saved draft, so resuming (even after an error / close-reopen) reuses
  // it and the server dedupes the re-publish instead of creating a duplicate.
  useEffect(() => {
    if (!state.clientDedupKey) {
      dispatch({ type: 'SET_FIELD', field: 'clientDedupKey', value: makeDedupKey() });
    }
  }, [state.clientDedupKey]);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // "Buy & Get Free Gift" mode
  const [isBuyGetFreeMode, setIsBuyGetFreeMode] = useState(false);

  // Dynamic step sequence
  const steps = useMemo(() => isBuyGetFreeMode ? BUY_GET_FREE_STEPS : NORMAL_STEPS, [isBuyGetFreeMode]);
  const stepLabels = useMemo(() => isBuyGetFreeMode ? BUY_GET_FREE_LABELS : NORMAL_LABELS, [isBuyGetFreeMode]);
  const totalSteps = steps.length;

  // Build edit step map for StepDotdReview
  const editStepMap = useMemo(() => {
    const map: Record<string, number> = {};
    steps.forEach((kind, idx) => { map[kind] = idx; });
    return map;
  }, [steps]);

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

  // Field name → step kind for moderation redirect
  const FIELD_TO_STEP_KIND: Record<string, StepKind> = {
    deal_heading: 'heading', localized_heading: 'heading',
    offer_value: 'offer', localized_offer: 'offer',
    long_description: 'description', localized_description: 'description',
  };

  const DRAFT_KEY = `dotd_wizard_draft_${user.id}`;

  // JWT heartbeat — refresh the access token every 4 minutes while the wizard is open.
  // Without this, a merchant who spends >55 minutes on the form hits "Session expired" at publish.
  useEffect(() => {
    const interval = setInterval(() => {
      supabase.auth.refreshSession().catch(err => {
        console.warn('[DotdWizard] Heartbeat refresh failed:', err?.message);
      });
    }, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Resume-prompt modal state — shown when a server-side draft is found at mount.
  const [resumePromptDraft, setResumePromptDraft] = useState<{
    payload: any;
    current_step: number;
    cover_image_url: string | null;
    additional_image_urls: string[];
    free_gift_image_urls: string[];
    is_buy_get_free: boolean;
    updated_at: string;
  } | null>(null);

  // Restore draft — server first (canonical), localStorage fallback.
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;

    (async () => {
      const [dotd, bgfDotd] = await Promise.all([
        campaignDraftService.load('dotd'),
        campaignDraftService.load('buy_get_free_dotd'),
      ]);
      const newest = [dotd, bgfDotd]
        .filter(Boolean)
        .sort((a, b) => new Date(b!.updated_at).getTime() - new Date(a!.updated_at).getTime())[0];

      if (newest) {
        setResumePromptDraft({
          payload: newest.payload,
          current_step: newest.current_step,
          cover_image_url: newest.cover_image_url,
          additional_image_urls: newest.additional_image_urls || [],
          free_gift_image_urls: newest.free_gift_image_urls || [],
          is_buy_get_free: newest.kind === 'buy_get_free_dotd',
          updated_at: newest.updated_at,
        });
        return;
      }

      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft && draft.dealHeading !== undefined) {
            const wasBuyGetFree = draft._isBuyGetFreeMode || (draft.freeGifts && draft.freeGifts.some((g: any) => g.imageUrl || g.name));
            if (wasBuyGetFree) setIsBuyGetFreeMode(true);
            dispatch({ type: 'RESTORE_DRAFT', draft });
            const savedStep = localStorage.getItem(DRAFT_KEY + '_step');
            if (savedStep) {
              const step = parseInt(savedStep);
              const maxSteps = wasBuyGetFree ? BUY_GET_FREE_STEPS.length : NORMAL_STEPS.length;
              if (step >= 0 && step < maxSteps) setCurrentStep(step);
            }
            console.log('[DotdWizard] Draft restored from localStorage, buyGetFreeMode:', wasBuyGetFree);
          }
        }
      } catch {}
    })();
  }, [DRAFT_KEY]);

  const handleResumeDraft = useCallback(() => {
    if (!resumePromptDraft) return;
    const d = resumePromptDraft;
    if (d.is_buy_get_free) setIsBuyGetFreeMode(true);
    const draftPayload: Partial<DotdWizardState> = {
      ...d.payload,
      existingThumbnail: d.cover_image_url || d.payload?.existingThumbnail || null,
      additionalImageUrls: d.additional_image_urls.length > 0 ? d.additional_image_urls : (d.payload?.additionalImageUrls || []),
    };
    dispatch({ type: 'RESTORE_DRAFT', draft: draftPayload });
    const maxSteps = d.is_buy_get_free ? BUY_GET_FREE_STEPS.length : NORMAL_STEPS.length;
    setCurrentStep(Math.min(Math.max(d.current_step, 0), maxSteps - 1));
    setResumePromptDraft(null);
  }, [resumePromptDraft]);

  // Both DOTD draft kinds (normal + buy-get-free) can coexist on the server.
  // The resume prompt shows whichever is newest, but any teardown MUST remove
  // BOTH — otherwise a leftover of the other kind keeps re-prompting forever
  // (this is exactly the "unfinished Deal of the Day" popup that wouldn't go
  // away). Returns combined orphaned image URLs. Best-effort.
  const deleteAllDotdDrafts = useCallback(async (): Promise<string[]> => {
    const orphans: string[] = [];
    for (const k of ['dotd', 'buy_get_free_dotd'] as CampaignDraftKind[]) {
      try {
        const { orphaned_image_urls } = await campaignDraftService.delete(k);
        if (orphaned_image_urls?.length) orphans.push(...orphaned_image_urls);
      } catch { /* best-effort */ }
    }
    return orphans;
  }, []);

  const handleDiscardServerDraft = useCallback(async () => {
    const orphans = await deleteAllDotdDrafts();
    if (orphans.length > 0) {
      try { await addCampaignService.destroyDraftImages(orphans); } catch { /* best-effort */ }
    }
    setResumePromptDraft(null);
  }, [deleteAllDotdDrafts]);

  // Save draft — both localStorage (instant) and server (debounced 2 s).
  const saveDraft = useCallback(() => {
    try {
      const { selectedImageFile, additionalImageFiles, selectedVideoFile, originalImageFile, ...serializable } = state;
      const serializableGifts = state.freeGifts.map(g => ({
        imageFile: null, imageUrl: g.imageUrl, name: g.name,
      }));
      const serializableState = { ...serializable, freeGifts: serializableGifts, _isBuyGetFreeMode: isBuyGetFreeMode };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializableState));
      localStorage.setItem(DRAFT_KEY + '_step', String(currentStep));

      const kind: CampaignDraftKind = isBuyGetFreeMode ? 'buy_get_free_dotd' : 'dotd';
      const giftUrls = (state.freeGifts || []).map(g => g.imageUrl).filter(Boolean) as string[];
      campaignDraftService.scheduleSave({
        kind,
        current_step: currentStep,
        payload: serializableState,
        cover_image_url: state.existingThumbnail || null,
        additional_image_urls: state.additionalImageUrls || [],
        free_gift_image_urls: giftUrls,
      });
    } catch {}
  }, [DRAFT_KEY, state, currentStep, isBuyGetFreeMode]);

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

  // When true, "Continue" on any step jumps back to Review instead of next step
  const [returnToReview, setReturnToReview] = useState(false);

  const handleNext = () => {
    setModerationAlert(null);
    saveDraft();
    if (returnToReview) {
      setReturnToReview(false);
      goToStep(totalSteps - 1);
      return;
    }
    goToStep(currentStep + 1);
  };

  const handleBack = () => {
    setModerationAlert(null);
    if (returnToReview) {
      setReturnToReview(false);
      goToStep(totalSteps - 1);
      return;
    }
    if (currentStep === 0) {
      setView('merchant_dashboard');
      return;
    }
    goToStep(currentStep - 1);
  };

  const handleEditFromReview = (stepIndex: number) => {
    setReturnToReview(true);
    goToStep(stepIndex);
  };

  const handlePublishSuccess = () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    // Server draft cleanup — fire and forget; published deal references the URLs.
    // Clear BOTH kinds so an old draft of the other kind can't re-prompt later.
    (async () => {
      try { await deleteAllDotdDrafts(); } catch { /* best-effort */ }
    })();
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
    const stepKind = FIELD_TO_STEP_KIND[field];
    if (stepKind) {
      const targetStep = editStepMap[stepKind];
      if (targetStep !== undefined) goToStep(targetStep);
    }
  };

  const handleClose = () => {
    setView('merchant_dashboard');
  };

  const handleDiscard = async () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    // On Start Over, delete BOTH server draft kinds AND destroy uploaded
    // Cloudinary draft assets.
    try {
      const orphans = await deleteAllDotdDrafts();
      if (orphans.length > 0) {
        await addCampaignService.destroyDraftImages(orphans);
      }
    } catch { /* best-effort */ }
    dispatch({ type: 'RESET' });
    setIsBuyGetFreeMode(false);
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

  // "Buy & Get Free Gift" template
  const handleBuyGetFreeSelect = () => {
    setIsBuyGetFreeMode(true);
    dispatch({ type: 'SET_FIELD', field: 'offerValue', value: 'Buy & Get Free Gift' });
    if (state.freeGifts.length === 0) {
      dispatch({ type: 'SET_FIELD', field: 'freeGifts', value: [emptyGift()] });
    }
    handleNext(); // Move to Image step
  };

  // --- Render Step ---
  const renderStep = () => {
    const kind = steps[currentStep];
    switch (kind) {
      case 'store':
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
      case 'template':
        return (
          <StepDotdTemplate
            onSelectTemplate={handleTemplateSelect}
            onSkip={handleNext}
            onBack={handleBack}
            theme={theme}
            onBuyGetFree={handleBuyGetFreeSelect}
            storeCategory={
              merchantStores.find((s) => s.id === state.selectedStoreId)?.store_category
              || user.category
            }
          />
        );
      case 'image':
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
            onFileSelected={(file) => {
              dispatch({ type: 'SET_FIELD', field: 'selectedImageFile', value: file });
              dispatch({ type: 'SET_FIELD', field: 'originalImageFile', value: file });
              dispatch({ type: 'SET_FIELD', field: 'bannerPlacement', value: 'auto' });
            }}
            onExistingSelected={(url, name) => {
              dispatch({ type: 'SET_FIELD', field: 'existingThumbnail', value: url || null });
              dispatch({ type: 'SET_FIELD', field: 'existingImageName', value: name });
              dispatch({ type: 'SET_FIELD', field: 'originalImageFile', value: null });
              dispatch({ type: 'SET_FIELD', field: 'bannerPlacement', value: 'auto' });
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
            storeName={user.store_name}
            dealHeading={state.dealHeading}
            offerValue={state.offerValue}
            merchantId={user.id}
          />
        );
      case 'freeGifts':
        return (
          <StepBuyGetFree
            gifts={state.freeGifts}
            onChange={(gifts) => dispatch({ type: 'SET_FIELD', field: 'freeGifts', value: gifts })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'heading':
        return (
          <StepHeading
            value={state.dealHeading}
            onChange={setField('dealHeading')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'offer':
        return (
          <StepOffer
            value={state.offerValue}
            onChange={setField('offerValue')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
            storeCategory={
              merchantStores.find((s) => s.id === state.selectedStoreId)?.store_category
              || user.category
            }
          />
        );
      case 'description':
        return (
          <StepDescription
            value={state.description}
            onChange={setField('description')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
            heading={state.dealHeading}
            offer={state.offerValue}
            freeGifts={state.freeGifts}
            isBuyGetFree={isBuyGetFreeMode}
          />
        );
      case 'badges':
        return (
          <StepTrustBadges
            selectedBadgeIds={state.trustBadgeIds}
            onChange={(ids) => dispatch({ type: 'SET_FIELD', field: 'trustBadgeIds', value: ids })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'bannerPlacement':
        return (
          <StepBannerPlacement
            originalImageFile={state.originalImageFile || state.selectedImageFile}
            existingThumbnail={state.existingThumbnail}
            storeName={merchantStores.find(s => s.id === state.selectedStoreId)?.store_name || user.store_name || ''}
            dealHeading={state.dealHeading}
            offerValue={state.offerValue}
            trustBadgeIds={state.trustBadgeIds}
            value={state.bannerPlacement}
            onChange={(p) => dispatch({ type: 'SET_FIELD', field: 'bannerPlacement', value: p })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'date':
        return (
          <StepDotdDate
            value={state.dealDate}
            onChange={setField('dealDate')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'review':
        return (
          <StepDotdReview
            wizardState={state}
            user={user}
            stores={merchantStores}
            onBack={handleBack}
            onPublishSuccess={handlePublishSuccess}
            onPublishError={handlePublishError}
            onModerationBlock={handleModerationBlock}
            onEditSection={handleEditFromReview}
            onUpdateMainImage={(file) => dispatch({ type: 'SET_FIELD', field: 'selectedImageFile', value: file })}
            onUpdateOriginalImage={(file) => dispatch({ type: 'SET_FIELD', field: 'originalImageFile', value: file })}
            onUpdateAdditional={(files, urls, overlays) => {
              dispatch({ type: 'SET_FIELD', field: 'additionalImageFiles', value: files });
              dispatch({ type: 'SET_FIELD', field: 'additionalImageUrls', value: urls });
              dispatch({ type: 'SET_FIELD', field: 'imagePriceOverlays', value: overlays });
            }}
            theme={theme}
            editStepMap={editStepMap}
            isBuyGetFreeMode={isBuyGetFreeMode}
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
        <span className={`text-xs font-semibold uppercase tracking-wider truncate max-w-[55%] text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {(() => {
            const selectedStore = merchantStores.find(s => s.id === state.selectedStoreId);
            if (selectedStore?.store_name) return selectedStore.store_name;
            return t('m_dotd_wizard_title');
          })()}
        </span>
        <button
          onClick={() => setShowDiscardConfirm(true)}
          className="px-3 h-9 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t('m_start_over_btn')}
        </button>
      </div>

      {/* Floating card */}
      <div className={`flex-1 flex flex-col mx-3 mt-1 mb-1 rounded-2xl shadow-lg overflow-hidden ${
        isDark ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Progress Bar (hide on Review step) */}
        {currentStep < totalSteps - 1 && (
          <div className="w-full flex items-center gap-1.5 px-5 pt-3 pb-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
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

      {/* Resume Draft Modal — shown on mount if a server-side draft exists. */}
      {resumePromptDraft && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              You have an unfinished Deal of the Day
            </h3>
            <p className={`text-sm mb-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              {(() => {
                const heading = (resumePromptDraft.payload?.dealHeading || '').trim();
                const when = new Date(resumePromptDraft.updated_at).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                });
                return heading
                  ? `“${heading}” — last edited ${when}. Resume where you left off, or start fresh?`
                  : `Last edited ${when}. Resume where you left off, or start fresh?`;
              })()}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDiscardServerDraft}
                className={`flex-1 h-11 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Start fresh
              </button>
              <button
                onClick={handleResumeDraft}
                className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all"
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

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
