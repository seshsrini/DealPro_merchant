import React, { useState, useEffect, useReducer, useCallback, useMemo, useRef } from 'react';
import { AppView, Deal, User } from './types';
import { X, CheckCircle2, Loader2, RotateCcw, Bookmark } from 'lucide-react';
import { addCampaignService } from './services/addCampaignService';
import { merchantService } from './services/merchantService';
import { supabase } from './services/supabaseClient';
import { campaignDraftService, CampaignDraftKind } from './services/draftService';
import { campaignTemplatesService, CampaignTemplate } from './services/campaignTemplatesService';
import { useTranslation } from './contexts/LanguageContext';

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
import { StepBuyGetFree, FreeGiftItem, emptyGift } from './components/campaign-wizard/StepBuyGetFree';
import { StepTrustBadges } from './components/campaign-wizard/StepTrustBadges';
import { StepBannerPlacement } from './components/campaign-wizard/StepBannerPlacement';

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
  // Multi-media: up to 5 images + 1 video
  additionalImageFiles: File[];
  additionalImageUrls: string[];
  selectedVideoFile: File | null;
  existingVideoUrl: string | null;
  imagePriceOverlays: Record<number, { discountPct: string; offerPrice: string }>;
  trustBadgeIds: string[];
  skipBannerGeneration: boolean;
  freeGifts: FreeGiftItem[];
  // Snapshot of the cover image as uploaded by the merchant. Used to re-bake
  // the banner cleanly when the merchant changes placement via the layout step.
  originalImageFile: File | null;
  // Cover banner text placement chosen by the merchant. 'auto' = heuristic decides.
  bannerPlacement: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'none';
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
  additionalImageFiles: [],
  additionalImageUrls: [],
  selectedVideoFile: null,
  existingVideoUrl: null,
  imagePriceOverlays: {},
  trustBadgeIds: [],
  skipBannerGeneration: false,
  freeGifts: [],
  originalImageFile: null,
  bannerPlacement: 'auto',
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESTORE_DRAFT':
      // Files can't be serialized — wipe every File-typed field so a stringified `{}` placeholder
      // doesn't survive the round-trip and confuse downstream code (e.g. bake-source resolution).
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
type StepKind = 'store' | 'template' | 'image' | 'freeGifts' | 'heading' | 'offer' | 'description' | 'badges' | 'bannerPlacement' | 'startDate' | 'endDate' | 'review';

const NORMAL_STEPS: StepKind[] = ['store', 'template', 'image', 'heading', 'offer', 'description', 'badges', 'bannerPlacement', 'startDate', 'endDate', 'review'];
const BUY_GET_FREE_STEPS: StepKind[] = ['store', 'template', 'image', 'freeGifts', 'heading', 'offer', 'description', 'badges', 'bannerPlacement', 'startDate', 'endDate', 'review'];

const NORMAL_LABELS = ['Store', 'Template', 'Image', 'Heading', 'Offer', 'Description', 'Badges', 'Layout', 'Start', 'End', 'Review'];
const BUY_GET_FREE_LABELS = ['Store', 'Template', 'Image', 'Gifts', 'Heading', 'Offer', 'Description', 'Badges', 'Layout', 'Start', 'End', 'Review'];

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
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const [isTransitioning, setIsTransitioning] = useState(false);
  // When true, "Continue" on any step jumps back to Review instead of next step
  const [returnToReview, setReturnToReview] = useState(false);

  // "Buy & Get Free Gift" special template mode
  const [isBuyGetFreeMode, setIsBuyGetFreeMode] = useState(false);

  // Dynamic step sequence
  const steps = useMemo(() => isBuyGetFreeMode ? BUY_GET_FREE_STEPS : NORMAL_STEPS, [isBuyGetFreeMode]);
  const stepLabels = useMemo(() => isBuyGetFreeMode ? BUY_GET_FREE_LABELS : NORMAL_LABELS, [isBuyGetFreeMode]);
  const totalSteps = steps.length;

  // Build edit step map for StepReview
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

  // Save-as-template flow
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  const DRAFT_KEY = `campaign_wizard_draft_${user.id}`;

  // JWT heartbeat — refresh the access token every 4 minutes while the wizard is open.
  // Default Supabase JWT TTL is 1 hour; refreshing periodically guarantees the token
  // is rarely close to expiry, even if the merchant takes a long time on the form
  // before publishing. Without this, a merchant who spends >55 minutes on the wizard
  // hits "Session expired" at publish time.
  useEffect(() => {
    const interval = setInterval(() => {
      supabase.auth.refreshSession().catch(err => {
        console.warn('[CampaignWizard] Heartbeat refresh failed:', err?.message);
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

  // Pre-populate for edit mode. We also jump straight to the Review step so
  // the merchant lands on the summary with per-section edit pencils instead
  // of being walked through every step of the wizard. Tracked by a ref so we
  // only do the jump once — subsequent re-renders / draft loads must not
  // re-route the user back to Review (they may have tapped a pencil to edit
  // a specific section).
  const editJumpedRef = useRef(false);
  useEffect(() => {
    if (editDealId && deals.length > 0) {
      const deal = deals.find(d => d.campaign_id === editDealId);
      if (deal) {
        const freeGifts = ((deal as any).free_gifts || []).map((g: any) => ({
          imageFile: null, imageUrl: g.image_url || null, name: g.name || '',
        }));
        // If deal has free_gifts, enable Buy & Get Free mode
        const isBuyGetFree = freeGifts.length > 0;
        if (isBuyGetFree) {
          setIsBuyGetFreeMode(true);
        }
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
            additionalImageUrls: deal.media_urls || [],
            existingVideoUrl: deal.video_url || null,
            imagePriceOverlays: ((deal as any).image_price_overlays || {}) as Record<number, { discountPct: string; offerPrice: string }>,
            trustBadgeIds: (deal as any).trust_badges || [],
            freeGifts,
          },
        });
        console.log('[CampaignWizard] Pre-populated from deal:', editDealId);

        if (!editJumpedRef.current) {
          editJumpedRef.current = true;
          // Pick the right review index based on which step list applies to
          // this deal — Buy & Get Free inserts an extra "freeGifts" step.
          const stepsForDeal = isBuyGetFree ? BUY_GET_FREE_STEPS : NORMAL_STEPS;
          const reviewIndex = stepsForDeal.indexOf('review');
          if (reviewIndex >= 0) setCurrentStep(reviewIndex);
        }
      }
    }
  }, [editDealId, deals]);

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

  // Restore draft for new campaigns only — tries server first, falls back to localStorage.
  // Server draft wins if found because it's the canonical source (survives device switches).
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (editDealId) return; // Don't restore draft when editing
    if (draftLoadedRef.current) return;
    draftLoadedRef.current = true;

    (async () => {
      // 1. Try server-side draft first (regular kind first, then DOTD-mode if present).
      // For now CampaignWizard only owns 'regular' and 'buy_get_free_regular' — DOTD lives in DotdWizard.
      // Probe both kinds and use whichever exists more recently.
      const [regular, bgfRegular] = await Promise.all([
        campaignDraftService.load('regular'),
        campaignDraftService.load('buy_get_free_regular'),
      ]);
      const newest = [regular, bgfRegular]
        .filter(Boolean)
        .sort((a, b) => new Date(b!.updated_at).getTime() - new Date(a!.updated_at).getTime())[0];

      if (newest) {
        setResumePromptDraft({
          payload: newest.payload,
          current_step: newest.current_step,
          cover_image_url: newest.cover_image_url,
          additional_image_urls: newest.additional_image_urls || [],
          free_gift_image_urls: newest.free_gift_image_urls || [],
          is_buy_get_free: newest.kind === 'buy_get_free_regular',
          updated_at: newest.updated_at,
        });
        return; // Wait for user choice in the modal — don't auto-restore.
      }

      // 2. No server draft — fall back to localStorage.
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
            console.log('[CampaignWizard] Draft restored from localStorage, buyGetFreeMode:', wasBuyGetFree);
          }
        }
      } catch {}
    })();
  }, [DRAFT_KEY, editDealId]);

  // Resume-prompt accept: hydrate state from the server draft.
  const handleResumeDraft = useCallback(() => {
    if (!resumePromptDraft) return;
    const d = resumePromptDraft;
    if (d.is_buy_get_free) setIsBuyGetFreeMode(true);
    // Hydrate wizard state from the persisted payload + the image URLs from the
    // dedicated columns (URLs are NOT in the payload — they're top-level on the row).
    const draftPayload: Partial<WizardState> = {
      ...d.payload,
      // URLs from drafts/ folder become the wizard's existing-thumbnail / additional-URLs.
      existingThumbnail: d.cover_image_url || d.payload?.existingThumbnail || null,
      additionalImageUrls: d.additional_image_urls.length > 0 ? d.additional_image_urls : (d.payload?.additionalImageUrls || []),
    };
    dispatch({ type: 'RESTORE_DRAFT', draft: draftPayload });
    const maxSteps = d.is_buy_get_free ? BUY_GET_FREE_STEPS.length : NORMAL_STEPS.length;
    setCurrentStep(Math.min(Math.max(d.current_step, 0), maxSteps - 1));
    setResumePromptDraft(null);
    console.log('[CampaignWizard] Resumed server draft from', d.updated_at);
  }, [resumePromptDraft]);

  // Delete BOTH campaign draft kinds the wizard owns ('regular' and
  // 'buy_get_free_regular'). The resume prompt appears if EITHER exists, so any
  // clear MUST remove both — otherwise a leftover of the other kind keeps
  // re-prompting. Returns combined orphaned image URLs. Best-effort.
  const deleteAllCampaignDrafts = useCallback(async (): Promise<string[]> => {
    const orphans: string[] = [];
    for (const k of ['regular', 'buy_get_free_regular'] as CampaignDraftKind[]) {
      try {
        const { orphaned_image_urls } = await campaignDraftService.delete(k);
        if (orphaned_image_urls?.length) orphans.push(...orphaned_image_urls);
      } catch { /* best-effort */ }
    }
    return orphans;
  }, []);

  // Resume-prompt decline: discard ANY server draft and start fresh.
  const handleDiscardServerDraft = useCallback(async () => {
    const orphans = await deleteAllCampaignDrafts();
    if (orphans.length > 0) {
      try { await addCampaignService.destroyDraftImages(orphans); } catch { /* best-effort */ }
    }
    setResumePromptDraft(null);
  }, [deleteAllCampaignDrafts]);

  // Save draft — writes to BOTH localStorage (instant fallback) and the server-side
  // campaign_drafts table (debounced 2 s). Server draft survives device switches and
  // app uninstall; localStorage survives offline pauses.
  const saveDraft = useCallback(() => {
    if (editDealId) return; // Don't save draft when editing
    try {
      // Strip every File-typed field — JSON.stringify turns a File into "{}" which would later
      // be rehydrated as a broken truthy value. Excluded fields are restored as null at runtime.
      const { selectedImageFile, additionalImageFiles, selectedVideoFile, originalImageFile, ...serializable } = state;
      // Strip File objects from freeGifts for serialization
      const serializableGifts = state.freeGifts.map(g => ({
        imageFile: null, imageUrl: g.imageUrl, name: g.name,
      }));
      const serializableState = { ...serializable, freeGifts: serializableGifts, _isBuyGetFreeMode: isBuyGetFreeMode };

      // localStorage (instant, offline-safe)
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializableState));
      localStorage.setItem(DRAFT_KEY + '_step', String(currentStep));

      // Server (debounced 2 s) — image URLs travel as top-level columns so the
      // cleanup sweep can find orphaned Cloudinary uploads via SQL.
      const kind: CampaignDraftKind = isBuyGetFreeMode ? 'buy_get_free_regular' : 'regular';
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
  }, [DRAFT_KEY, state, currentStep, editDealId, isBuyGetFreeMode]);

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
    // If we jumped here from Review to edit a section, go back to Review
    if (returnToReview) {
      setReturnToReview(false);
      goToStep(totalSteps - 1); // Review is always the last step
      return;
    }
    // In edit mode, skip Template step (step 1) going forward from Store (step 0)
    const nextStep = (editDealId && currentStep === 0) ? 2 : currentStep + 1;
    goToStep(nextStep);
  };

  const handleBack = () => {
    // If we jumped here from Review, cancel the edit and go back to Review
    if (returnToReview) {
      setReturnToReview(false);
      goToStep(totalSteps - 1);
      return;
    }
    if (currentStep === 0) {
      setView('merchant_deals');
      return;
    }
    // In edit mode, skip Template step (step 1) going back from Image (step 2)
    const prevStep = (editDealId && currentStep === 2) ? 0 : currentStep - 1;
    goToStep(prevStep);
  };

  // Called from Review page edit pencils — jump to a specific step, then return
  const handleEditFromReview = (stepIndex: number) => {
    setReturnToReview(true);
    goToStep(stepIndex);
  };

  const handlePublishSuccess = async () => {
    // Clear draft (both localStorage AND server). On publish-success we DO NOT destroy
    // the drafts/ Cloudinary assets — the published deal references those URLs. The
    // assets remain in the dealpro-drafts/ folder forever; that's acceptable since
    // they're still served by Cloudinary's CDN at the same URL.
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    // Clear BOTH kinds so a leftover of the other kind can't re-prompt later.
    // Ignore orphaned URLs — they're now referenced by the published deal.
    await deleteAllCampaignDrafts();
    await refreshDeals();

    // For new campaigns, ask if they want to save as template
    if (!editDealId) {
      setTemplateName(state.dealHeading || '');
      setShowSaveTemplate(true);
    } else {
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setView('merchant_deals');
      }, 3000);
    }
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
          launch_date: state.startDate,
          end_date: state.endDate,
          category: user.category,
        },
      });
      setTemplateSaved(true);
    } catch {
      // Non-blocking — template save failure shouldn't block success flow
    } finally {
      setSavingTemplate(false);
    }
    // Show success after a brief moment
    setTimeout(() => {
      setShowSaveTemplate(false);
      setTemplateSaved(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setView('merchant_deals');
      }, 3000);
    }, 1500);
  };

  const handleSkipTemplate = () => {
    setShowSaveTemplate(false);
    setShowSuccess(true);
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

  const handleDiscard = async () => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_KEY + '_step');
    // On Start Over, delete BOTH server draft kinds AND destroy any uploaded
    // Cloudinary draft assets — those images won't survive into a published deal
    // so they're true orphans. Best-effort; the cleanup cron is the safety net.
    const orphans = await deleteAllCampaignDrafts();
    if (orphans.length > 0) {
      try { await addCampaignService.destroyDraftImages(orphans); } catch { /* best-effort */ }
    }
    dispatch({ type: 'RESET' });
    setIsBuyGetFreeMode(false);
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

  // "Buy & Get Free Gift" template — enters free gift mode
  const handleBuyGetFreeSelect = () => {
    setIsBuyGetFreeMode(true);
    dispatch({ type: 'SET_FIELD', field: 'offerValue', value: 'Buy & Get Free Gift' });
    if (state.freeGifts.length === 0) {
      dispatch({ type: 'SET_FIELD', field: 'freeGifts', value: [emptyGift()] });
    }
    handleNext(); // Move to Image step (step 2) — normal image upload
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
          <StepTemplate
            merchantId={user.id}
            onSelectTemplate={handleTemplateSelect}
            onSkip={handleNext}
            onBack={handleBack}
            theme={theme}
            onBuyGetFree={handleBuyGetFreeSelect}
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
              // Snapshot the freshly uploaded file as the bake source. Locks in the clean
              // original so re-bakes (toggle, heading edit) don't paint over a prior banner.
              dispatch({ type: 'SET_FIELD', field: 'originalImageFile', value: file });
              dispatch({ type: 'SET_FIELD', field: 'bannerPlacement', value: 'auto' });
            }}
            onExistingSelected={(url, name) => {
              dispatch({ type: 'SET_FIELD', field: 'existingThumbnail', value: url || null });
              dispatch({ type: 'SET_FIELD', field: 'existingImageName', value: name });
              // URL source — StepReview will fetch and snapshot. If the URL points at a
              // previously baked banner, the bake is skipped (see source-is-baked check).
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
      case 'startDate':
        return (
          <StepStartDate
            value={state.startDate}
            onChange={setField('startDate')}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 'endDate':
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
      case 'review':
        return (
          <StepReview
            wizardState={state}
            user={user}
            stores={merchantStores}
            editingDealId={editDealId || null}
            onBack={handleBack}
            onPublishSuccess={handlePublishSuccess}
            onPublishError={handlePublishError}
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
        <span className={`text-xs font-semibold uppercase tracking-wider truncate max-w-[55%] text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {(() => {
            // Once a store is picked, show its name as the wizard's reference label
            // so the merchant always knows which store this deal is for. Falls back
            // to the generic "New / Edit Campaign" label before a store is selected.
            const selectedStore = merchantStores.find(s => s.id === state.selectedStoreId);
            if (selectedStore?.store_name) return selectedStore.store_name;
            return editDealId ? t('m_edit_campaign') : t('m_new_campaign');
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

      {/* Resume Draft Modal — shown on mount if a server-side draft exists. */}
      {resumePromptDraft && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              You have an unfinished deal
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
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                    <Bookmark className="w-6 h-6 text-indigo-500" />
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
                      ? 'bg-slate-800 text-white border border-slate-700 focus:border-indigo-500'
                      : 'bg-slate-50 text-slate-900 border border-slate-200 focus:border-indigo-500'
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
                    className="flex-1 h-11 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {editDealId ? t('m_campaign_updated') : t('m_campaign_published')}
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {t('m_deal_live')}
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
