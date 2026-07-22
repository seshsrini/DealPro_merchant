import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { AppView, StoreLocation, User } from './types';
import { merchantOnboardingService } from './services/merchantOnboardingService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { encryptionService, auditLogger } from './services/encryptionService';
import { biometricService } from './services/biometricService';
import { signupDraftService } from './services/draftService';
import { PLAY_COMPLIANT } from './services/playCompliance';
import { Loader2 } from 'lucide-react';

// Step components
import { StepWelcome } from './components/merchant-onboarding/StepWelcome';
import { StepFullName } from './components/merchant-onboarding/StepFullName';
import { StepStoreName } from './components/merchant-onboarding/StepStoreName';
import { StepStoreAddress } from './components/merchant-onboarding/StepStoreAddress';
import { StepAddMoreStores } from './components/merchant-onboarding/StepAddMoreStores';
import { StepBusinessVerification } from './components/merchant-onboarding/StepBusinessVerification';
import { StepTermsOfService } from './components/merchant-onboarding/StepTermsOfService';
import { StepPrivacyPolicy } from './components/merchant-onboarding/StepPrivacyPolicy';
import { StepReviewDetails } from './components/merchant-onboarding/StepReviewDetails';
import { StepSubscription } from './components/merchant-onboarding/StepSubscription';
import { StepPayment } from './components/merchant-onboarding/StepPayment';
import { StepCongrats } from './components/merchant-onboarding/StepCongrats';

// --- Types ---
type BusinessType = '' | 'gstin' | 'udyam' | 'fssai' | 'trade_license' | 'none';

interface WizardState {
  fullName: string;
  storeName: string;
  category: string;
  stores: StoreLocation[];
  businessType: BusinessType;
  gstinValue: string;
  panValue: string;
  udyamValue: string;
  fssaiValue: string;
  tradeLicenseValue: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

type WizardAction =
  | { type: 'SET_FIELD'; field: keyof WizardState; value: any }
  | { type: 'ADD_STORE'; brandName?: string }
  | { type: 'REMOVE_STORE'; index: number }
  | { type: 'UPDATE_STORE'; index: number; field: keyof StoreLocation; value: any }
  | { type: 'RESTORE_DRAFT'; draft: WizardState };

const createEmptyStore = (): StoreLocation => ({
  store_name: '', street: '', pincode: '', locality: '', state: '', city: '',
  landmark: '', store_category: '', store_phone: '', store_phone_alt: '',
  coords: null, isGeocoding: false,
  shift1: '9:00 AM', shift2: '10:00 PM', is24hrs: false, isPincodeSearching: false,
  delivers: false, delivery_radius_km: null,
});

// Has the merchant actually put anything into this store? Same test isStepComplete
// uses for the Address step, so "counts as filled in" means one thing everywhere.
const storeHasData = (s: StoreLocation | undefined): boolean =>
  !!(s && (s.city || s.street || s.pincode));

const initialState: WizardState = {
  fullName: '', storeName: '', category: '',
  stores: [createEmptyStore()],
  businessType: '',
  gstinValue: '', panValue: '', udyamValue: '', fssaiValue: '', tradeLicenseValue: '',
  termsAccepted: false, privacyAccepted: false,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'ADD_STORE':
      return { ...state, stores: [...state.stores, { ...createEmptyStore(), store_name: action.brandName || '' }] };
    case 'REMOVE_STORE': {
      const stores = state.stores.filter((_, i) => i !== action.index);
      // Never leave the wizard with zero stores — the address step reads
      // stores[editingStoreIndex] and would fall back to a throwaway object whose
      // edits go nowhere. Callers also guard against deleting the last store.
      return { ...state, stores: stores.length > 0 ? stores : [createEmptyStore()] };
    }
    case 'UPDATE_STORE': {
      const stores = [...state.stores];
      stores[action.index] = { ...stores[action.index], [action.field]: action.value };
      return { ...state, stores };
    }
    case 'RESTORE_DRAFT':
      return action.draft;
    default:
      return state;
  }
}

// --- Step Definitions ---
const STEP_LABELS = [
  'Welcome', 'Name', 'Store', '', 'Address', 'Stores',
  'Verification', 'Review', 'Terms', 'Privacy', 'Plan', 'Payment', 'Done',
];
const TOTAL_STEPS = STEP_LABELS.length;

// --- Component ---
interface MerchantOnboardingProps {
  setView: (view: AppView) => void;
  user: User;
  setUser: (user: User) => void;
  theme: 'light' | 'dark';
  // Called when signup finishes but the merchant still has to subscribe on the
  // web (Play-compliant build). App uses it to auto-redirect them to the
  // dashboard once the subscription activates, instead of leaving them on the
  // my-subscription page.
  onAwaitWebSubscription?: () => void;
}

export const MerchantOnboarding: React.FC<MerchantOnboardingProps> = ({
  setView, user, setUser, theme, onAwaitWebSubscription,
}) => {
  const isDark = theme === 'dark';
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const [currentStep, setCurrentStep] = useState(0);
  const [editingStoreIndex, setEditingStoreIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  // True while the Address step is showing a store the merchant just added from
  // the store list, so Back can mean "cancel this store" instead of "previous step".
  const [addingNewStore, setAddingNewStore] = useState(false);
  // Set when the merchant taps "Edit legal name" on a GST mismatch — Continue/Back
  // from step 2 then returns them straight to the verification step.
  const [returnToVerification, setReturnToVerification] = useState(false);
  // Bumped when returning to verification after a legal-name edit → triggers
  // an automatic GST re-verify with the corrected name.
  const [gstReverifyNonce, setGstReverifyNonce] = useState(0);
  const [hasExistingStores, setHasExistingStores] = useState(false);
  const [lastSubscriptionFee, setLastSubscriptionFee] = useState(0);
  const [lastSubscriptionId, setLastSubscriptionId] = useState<number | null>(null);
  const [lastTierKey, setLastTierKey] = useState<string | null>(null);

  const DRAFT_KEY = `merchant_onboarding_draft_${user.id}`;

  // On mount: pre-fill wizard from existing profile data and skip to first missing step
  useEffect(() => {
    localStorage.removeItem(DRAFT_KEY);

    // Pre-fill from existing profile
    if (user.full_name) dispatch({ type: 'SET_FIELD', field: 'fullName', value: user.full_name });
    // Step 2 now holds the legal name of business; fall back to the legacy
    // store_name for merchants who onboarded before this field existed.
    if ((user as any).legal_name || user.store_name) {
      dispatch({ type: 'SET_FIELD', field: 'storeName', value: (user as any).legal_name || user.store_name });
    }
    if (user.category) dispatch({ type: 'SET_FIELD', field: 'category', value: user.category });
    if (user.business_type) dispatch({ type: 'SET_FIELD', field: 'businessType', value: user.business_type });
    if (user.gstin) dispatch({ type: 'SET_FIELD', field: 'gstinValue', value: user.gstin });
    if (user.pan) dispatch({ type: 'SET_FIELD', field: 'panValue', value: user.pan });
    if (user.udyam_no) dispatch({ type: 'SET_FIELD', field: 'udyamValue', value: user.udyam_no });
    if (user.fssai_no) dispatch({ type: 'SET_FIELD', field: 'fssaiValue', value: user.fssai_no });
    if (user.trade_license_no) dispatch({ type: 'SET_FIELD', field: 'tradeLicenseValue', value: user.trade_license_no });
    if (user.terms_accepted) dispatch({ type: 'SET_FIELD', field: 'termsAccepted', value: true });
    if (user.privacy_accepted) dispatch({ type: 'SET_FIELD', field: 'privacyAccepted', value: true });

    // Try to load any server-side onboarding draft (typed-but-unsaved fields).
    // Best-effort: silently merge on top of profile pre-fill. Never blocks navigation.
    (async () => {
      try {
        const draft = await signupDraftService.load();
        if (draft && draft.payload && typeof draft.payload === 'object') {
          // Apply each field from the payload — overwrites profile pre-fill so the
          // merchant sees what they last typed.
          for (const [field, value] of Object.entries(draft.payload)) {
            if (value === undefined || value === null) continue;
            dispatch({ type: 'SET_FIELD', field: field as any, value });
          }
          if (Number.isInteger(draft.current_step) && draft.current_step > 0) {
            // Only honor a draft step if it's further along than the determined start step.
            // determineStartStep below will run after; we prefer whichever is later.
            setCurrentStep(prev => Math.max(prev, draft.current_step));
          }
          console.log('[MerchantOnboarding] Server signup draft applied (step', draft.current_step, ')');
        }
      } catch { /* best-effort */ }
    })();

    // If profile is already complete but subscription is missing/expired,
    // jump directly to subscription step (step 10).
    // For brand-new merchants whose profile is incomplete, fall through to
    // determineStartStep() so the wizard guides them through Name → Store → etc.
    const profileComplete = !!(user.full_name && user.store_name && user.business_type && user.terms_accepted && user.privacy_accepted);
    if (!user.hasActiveSubscription && profileComplete) {
      console.log('[MerchantOnboarding] Profile complete but no active subscription — jumping to subscription step, trialExpired:', (user as any).trialExpired);
      setCurrentStep(10);
      return;
    }

    // Check if merchant already has stores in DB, then determine start step
    // Uses Edge Function (service_role) to bypass RLS on merchant_stores
    const determineStartStep = async () => {
      let hasStores = false;
      try {
        const subInfo = await merchantSubscriptionService.checkActiveSubscription(user.id);
        hasStores = (subInfo.storeCount ?? 0) > 0;
        setHasExistingStores(hasStores);
      } catch { /* assume no stores */ }

      // Steps: 0=Welcome, 1=Name, 2=Store, 4=Address, 5=Stores, 6=Verification, 7=Review, 8=Terms, 9=Privacy
      // (Step 3 Category removed — auto-computed as single/multiple at submission)
      // Brand-new merchants (no full_name) always start at step 0 (Welcome) — they must acknowledge it.
      // Returning merchants who partially completed onboarding skip to their first missing step.
      let startStep = 0;
      if (user.full_name && !user.store_name) { startStep = 2; }
      else if (user.full_name && user.store_name && !hasStores) { startStep = 4; }
      else if (user.full_name && user.store_name && hasStores && !user.business_type) { startStep = 6; }
      else if (user.full_name && user.store_name && hasStores && user.business_type && !user.terms_accepted) { startStep = 8; }
      else if (user.full_name && user.store_name && hasStores && user.business_type && user.terms_accepted && !user.privacy_accepted) { startStep = 9; }
      else if (user.full_name && user.store_name && hasStores && user.business_type && user.terms_accepted && user.privacy_accepted) { startStep = 7; } // Everything filled — show review

      if (startStep > 0) {
        // Use Math.max so we don't clobber a higher step that the server-draft
        // load (running async in parallel above) may have already set.
        setCurrentStep(prev => Math.max(prev, startStep));
        console.log(`[MerchantOnboarding] Pre-filled from profile, starting at step ${startStep} (${STEP_LABELS[startStep]}), hasStores: ${hasStores}`);
      }
    };

    determineStartStep();
  }, [DRAFT_KEY]);

  // Save draft — both localStorage (instant) and server (debounced 2 s).
  // The merchant_profiles / merchant_stores tables already accumulate completed-step
  // data via saveStepProgress(). signup_drafts captures the IN-PROGRESS step state
  // (partially typed fields) and the current step number for resume positioning.
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      signupDraftService.scheduleSave({
        current_step: currentStep,
        payload: state,
      });
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

  // Check if a step's data is already filled (used to skip pre-completed steps)
  const isStepComplete = (step: number): boolean => {
    switch (step) {
      case 0: return true; // Welcome — always skippable
      case 1: return !!state.fullName;
      case 2: return !!state.storeName;
      case 3: return true; // Category step removed — always skipped
      case 4: return hasExistingStores || state.stores.some(s => !!(s.city || s.street || s.pincode));
      case 5: return hasExistingStores; // Only skip if stores already exist in DB; always show for new signups
      case 6: return !!state.businessType;
      // Steps 7+ (Review, Terms, Privacy, Plan, Done) are never skipped
      default: return false;
    }
  };

  // In-progress wizard data is staged in the server-side `signup_drafts` table
  // via saveDraft() → signupDraftService.scheduleSave. We intentionally do NOT
  // write to merchant_profiles / merchant_stores step-by-step anymore — that
  // used to leak partial rows into the real tables, which then made any
  // abandoned signup look like an "existing merchant with an incomplete profile"
  // on next login (the user had to refill everything from the first missing
  // step). The proper commit happens once, at the end, via completeMerchantProfile.
  //
  // Kept as a no-op so we don't have to remove every call site — if a step
  // genuinely needs a side-effect (e.g. uploading an image), wire it there.
  const saveStepProgress = (_step: number) => {
    /* intentionally empty — see comment above */
  };

  const handleNext = () => {
    saveDraft();
    // Persist step data to DB before navigating away
    saveStepProgress(currentStep);
    // Completing the Address step commits the new store — Back is a plain
    // step-back again from here on.
    if (currentStep === 4 && addingNewStore) setAddingNewStore(false);
    // Editing the legal name from the verification step → jump straight back
    // and auto re-verify GST with the corrected name.
    if (returnToVerification && currentStep === 2) {
      setReturnToVerification(false);
      setGstReverifyNonce((n) => n + 1);
      goToStep(6);
      return;
    }
    if (returnToReview && currentStep >= 1 && currentStep <= 6) {
      // After editing from review, return to review step
      // Special case: step 4 (Address) always goes to step 5 (Store List) first
      if (currentStep === 4) {
        goToStep(5);
      } else {
        setReturnToReview(false);
        goToStep(7);
      }
    } else {
      // Skip forward past any steps that already have data
      let next = currentStep + 1;
      while (next < 7 && isStepComplete(next)) {
        console.log(`[MerchantOnboarding] Skipping step ${next} (${STEP_LABELS[next]}) — already complete`);
        next++;
      }
      goToStep(next);
    }
  };

  const handleBack = () => {
    if (returnToVerification && currentStep === 2) {
      setReturnToVerification(false);
      setGstReverifyNonce((n) => n + 1);
      goToStep(6);
      return;
    }
    if (returnToReview && currentStep !== 7) {
      // When editing from review, "Back" returns to review instead of previous step
      setReturnToReview(false);
      goToStep(7);
      return;
    }
    // Backing out of a store the merchant just added = cancel it. Without this,
    // Back left the blank store in state (it showed up in the list and got
    // submitted) and navigated to the step before Address — not the store list (5)
    // the merchant actually came from. Only discard when nothing was filled in, so
    // a half-typed address isn't silently thrown away.
    if (currentStep === 4 && addingNewStore) {
      setAddingNewStore(false);
      if (!storeHasData(state.stores[editingStoreIndex])) {
        dispatch({ type: 'REMOVE_STORE', index: editingStoreIndex });
        setEditingStoreIndex(Math.max(0, editingStoreIndex - 1));
      }
      goToStep(5);
      return;
    }
    if (currentStep <= 0) return; // Don't go before welcome
    // Skip structurally-removed steps (empty label, e.g. the old Category step
    // at index 3) so Back never lands on a screen that no longer exists.
    let prev = currentStep - 1;
    while (prev > 0 && STEP_LABELS[prev] === '') prev--;
    goToStep(prev);
  };

  // From a GST legal-name mismatch: go edit the legal name (step 2), then return.
  const handleEditLegalName = () => {
    setReturnToVerification(true);
    goToStep(2);
  };

  const handleEditFromReview = (targetStep: number, storeIndex?: number) => {
    setReturnToReview(true);
    if (storeIndex !== undefined) setEditingStoreIndex(storeIndex);
    goToStep(targetStep);
  };

  // Store address handlers
  const handleStoreFieldChange = (field: keyof StoreLocation, value: any) => {
    dispatch({ type: 'UPDATE_STORE', index: editingStoreIndex, field, value });
  };

  const handleAddStore = () => {
    dispatch({ type: 'ADD_STORE', brandName: state.storeName });
    setEditingStoreIndex(state.stores.length);
    setAddingNewStore(true); // lets Back cancel this store instead of walking a step
    goToStep(4); // Go back to address step for new store
  };

  // Remove a store from the signup list. Guarded so the merchant can't delete
  // their way down to zero stores.
  const handleDeleteStore = (index: number) => {
    if (state.stores.length <= 1) return;
    dispatch({ type: 'REMOVE_STORE', index });
    setEditingStoreIndex(prev => (prev >= index && prev > 0 ? prev - 1 : prev));
  };

  // Final submission
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Encrypt GSTIN/PAN if applicable
      let encryptedGstin: string | null = null;
      let encryptedPan: string | null = null;

      if (state.businessType === 'gstin') {
        const gstResult = encryptionService.encryptGST(state.gstinValue);
        const panResult = encryptionService.encryptPAN(state.panValue);
        if (!gstResult.isValid) throw new Error(gstResult.error || 'GST encryption failed');
        if (!panResult.isValid) throw new Error(panResult.error || 'PAN encryption failed');
        encryptedGstin = gstResult.encrypted;
        encryptedPan = panResult.encrypted;
        auditLogger.logSensitiveDataAccess('ENCRYPT_FOR_ONBOARDING', 'GST');
        auditLogger.logSensitiveDataAccess('ENCRYPT_FOR_ONBOARDING', 'PAN');
      }

      const filteredStores = state.stores.filter(s => s.city || s.street || s.pincode);
      await merchantOnboardingService.completeMerchantProfile({
        userId: user.id,
        fullName: state.fullName,
        storeName: state.storeName,
        legalName: state.storeName, // step 2 is now the legal name of business
        category: filteredStores.length > 1 ? 'multiple' : 'single',
        businessType: state.businessType,
        gstin: encryptedGstin,
        pan: encryptedPan,
        udyamNo: state.businessType === 'udyam' ? state.udyamValue.toUpperCase() : null,
        fssaiNo: state.businessType === 'fssai' ? state.fssaiValue : null,
        tradeLicenseNo: state.businessType === 'trade_license' ? state.tradeLicenseValue.toUpperCase() : null,
        termsAccepted: true,
        privacyAccepted: true,
        stores: filteredStores.map(s => ({
            store_name:     s.store_name || state.storeName,
            address:        s.street,
            pincode:        s.pincode,
            locality:       s.locality,
            city:           s.city,
            state:          s.state,
            landmark:       s.landmark,
            store_category: s.store_category || '',
            latitude:       s.coords?.latitude || 0,
            longitude:      s.coords?.longitude || 0,
            store_hrs:      s.is24hrs ? 'Open 24 Hours' : `${s.shift1} - ${s.shift2}`,
            store_phone:    s.store_phone || null,
            store_phone_alt: s.store_phone_alt || null,
            delivers:       s.delivers || false,
            delivery_radius_km: s.delivers && s.delivery_radius_km != null ? Number(s.delivery_radius_km) : null,
          })),
      });

      // Clear draft (localStorage + server-side signup_drafts)
      localStorage.removeItem(DRAFT_KEY);
      try { await signupDraftService.delete(); } catch { /* best-effort */ }

      // Update user state with ALL profile-completeness fields
      const updatedUser = {
        ...user,
        full_name: state.fullName,
        store_name: state.storeName,
        legal_name: state.storeName,
        category: filteredStores.length > 1 ? 'multiple' : 'single',
        business_type: state.businessType,
        terms_accepted: true,
        privacy_accepted: true,
      };
      setUser(updatedUser);

      // Decide whether to skip the subscription step by re-verifying the ACTUAL
      // subscription status from the server — NOT user.hasActiveSubscription, which
      // can be stale (a saved/biometric session carried over from a previously
      // subscribed account, or a since-expired sub). Trusting the stale flag was
      // skipping the subscription step for merchants who haven't actually
      // subscribed (they landed on the dashboard with no plan / no deal limits).
      let actuallySubscribed = false;
      try {
        const subInfo = await merchantSubscriptionService.checkActiveSubscription(user.id, (user as any).access_token);
        actuallySubscribed = !!subInfo.hasActiveSubscription;
      } catch (e) {
        // If the check fails, default to SHOWING the subscription step rather than
        // skipping it — never let a merchant reach the dashboard unsubscribed.
        console.warn('[MerchantOnboarding] Subscription re-check failed; showing subscription step:', e);
        actuallySubscribed = false;
      }
      // Keep the user object consistent with the verified status.
      setUser({ ...updatedUser, hasActiveSubscription: actuallySubscribed });
      await biometricService.saveSession({ ...updatedUser, hasActiveSubscription: actuallySubscribed });

      if (PLAY_COMPLIANT || actuallySubscribed) {
        // Compliant build: never show an in-app plan picker. Go to the dashboard;
        // the merchant activates their plan on the web and the deal-posting gate
        // guides them there. (Non-compliant: skip the step only when already
        // subscribed.)
        goToStep(12); // Congrats → dashboard
      } else {
        goToStep(10); // Subscription selection (non-compliant only)
      }
    } catch (err: any) {
      console.error('[MerchantOnboarding] Submit error:', err);
      // Surface the real reason (e.g. a missing column / RLS) so issues are
      // diagnosable instead of always showing a generic message.
      const detail = err?.message && !/^unable to/i.test(err.message) ? ` (${err.message})` : '';
      setSubmitError(`Unable to save profile. Please try again.${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle privacy accepted → submit profile data, then show subscription
  const handlePrivacyNext = () => {
    dispatch({ type: 'SET_FIELD', field: 'privacyAccepted', value: true });
    saveDraft();
    handleFinalSubmit();
  };

  const handleTermsNext = () => {
    dispatch({ type: 'SET_FIELD', field: 'termsAccepted', value: true });
    saveDraft();
    goToStep(9); // Privacy step
  };

  // StepSubscription's "Continue" advances here without creating a
  // subscription. The Razorpay payment now happens in StepPayment (next step).
  //
  // Exception: when a subscription was already created synchronously
  // (alreadyActive=true — dev test bypass / legacy trial path), skip the
  // payment step entirely so the merchant doesn't get charged twice.
  const handleSubscriptionComplete = async (
    subscriptionFee?: number,
    subscriptionId?: number,
    tierKey?: string,
    alreadyActive?: boolean,
  ) => {
    setLastSubscriptionFee(subscriptionFee || 0);
    setLastSubscriptionId(subscriptionId || null);
    setLastTierKey(tierKey || null);
    if (alreadyActive) {
      localStorage.removeItem(DRAFT_KEY);
      goToStep(12); // Congrats
      return;
    }
    goToStep(11); // Payment step (where Razorpay is taken).
  };

  const handlePaymentComplete = () => {
    localStorage.removeItem(DRAFT_KEY);
    goToStep(12); // Congrats
  };

  // Congrats → go to dashboard
  const handleGoToDashboard = () => {
    // Compliant build: an unsubscribed merchant activates their plan on the web,
    // so land them on the read-only subscription screen (with the manage-on-web
    // link) rather than a dashboard they can't post deals from yet.
    if (PLAY_COMPLIANT && !user.hasActiveSubscription) {
      // They subscribe on the web from here; arm the auto-redirect so that once
      // the subscription activates, App carries them into the dashboard rather
      // than leaving them parked on this read-only my-subscription page.
      onAwaitWebSubscription?.();
      setView('merchant_subscriptions');
      return;
    }
    setView('merchant_dashboard');
  };

  // --- Render ---
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepWelcome
            onNext={handleNext}
            theme={theme}
          />
        );
      case 1:
        return (
          <StepFullName
            value={state.fullName}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'fullName', value: v })}
            onNext={handleNext}
            onBack={returnToReview ? undefined : handleBack}
            theme={theme}
          />
        );
      case 2:
        return (
          <StepStoreName
            value={state.storeName}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'storeName', value: v })}
            onNext={handleNext}
            onBack={returnToReview ? undefined : handleBack}
            theme={theme}
            originalValue={(user as any).legal_name || user.store_name || ''}
          />
        );
      case 3:
        // Category step removed — auto-computed (single/multiple) at submission.
        // Never navigated to; render nothing so the old screen can't appear.
        return null;
      case 4:
        return (
          <StepStoreAddress
            store={state.stores[editingStoreIndex] || createEmptyStore()}
            storeIndex={editingStoreIndex}
            totalStores={state.stores.length}
            brandName={state.storeName}
            onChange={handleStoreFieldChange}
            onNext={handleNext}
            onBack={returnToReview ? undefined : handleBack}
            theme={theme}
          />
        );
      case 5:
        return (
          <StepAddMoreStores
            stores={state.stores}
            brandName={state.storeName}
            onAddStore={handleAddStore}
            onDeleteStore={handleDeleteStore}
            onNext={handleNext}
            onBack={returnToReview ? undefined : handleBack}
            theme={theme}
          />
        );
      case 6:
        return (
          <StepBusinessVerification
            businessType={state.businessType}
            legalName={state.storeName}
            gstinValue={state.gstinValue}
            panValue={state.panValue}
            udyamValue={state.udyamValue}
            fssaiValue={state.fssaiValue}
            tradeLicenseValue={state.tradeLicenseValue}
            onChangeType={(v) => dispatch({ type: 'SET_FIELD', field: 'businessType', value: v })}
            onChangeField={(field, value) => dispatch({ type: 'SET_FIELD', field: field as keyof WizardState, value })}
            onNext={handleNext}
            onBack={returnToReview ? undefined : handleBack}
            onEditLegalName={handleEditLegalName}
            reverifyTrigger={gstReverifyNonce}
            theme={theme}
          />
        );
      case 7:
        return (
          <StepReviewDetails
            state={state}
            onEditStep={handleEditFromReview}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 8:
        return (
          <StepTermsOfService
            onNext={handleTermsNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 9:
        return submitting ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-slate-700" />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Saving your profile...</p>
          </div>
        ) : submitError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
            <p className="text-sm text-red-500 text-center">{submitError}</p>
            <button
              onClick={handleFinalSubmit}
              className="h-12 px-6 rounded-xl bg-slate-900 text-white text-sm font-semibold"
            >
              Retry
            </button>
          </div>
        ) : (
          <StepPrivacyPolicy
            onNext={handlePrivacyNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 10:
        return (
          <StepSubscription
            user={user}
            setUser={setUser}
            onComplete={handleSubscriptionComplete}
            onBack={handleBack}
            theme={theme}
            trialExpired={!!((user as any).trialExpired && !user.hasActiveSubscription)}
          />
        );
      case 11:
        return (
          <StepPayment
            user={user}
            subscriptionFee={lastSubscriptionFee}
            tierKey={lastTierKey}
            onComplete={handlePaymentComplete}
            theme={theme}
          />
        );
      case 12:
        return (
          <StepCongrats
            storeName={state.storeName}
            onGoToDashboard={handleGoToDashboard}
            theme={theme}
            pendingSubscription={PLAY_COMPLIANT && !user.hasActiveSubscription}
          />
        );
      default:
        return null;
    }
  };

  // Don't show progress bar on Terms/Privacy/Subscription steps (they have their own UI)
  const showProgressBar = currentStep >= 1 && currentStep <= 7;

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
      {/* Floating card */}
      <div className={`flex-1 flex flex-col mx-3 mt-2 mb-1 rounded-2xl shadow-lg overflow-hidden ${
        isDark ? 'bg-slate-900' : 'bg-white'
      }`}>
        {/* Progress Bar */}
        {showProgressBar && (
          <div className="w-full flex items-center gap-1.5 px-5 pt-3 pb-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${
                  i < currentStep
                    ? 'bg-slate-900'
                    : i === currentStep
                      ? 'bg-slate-500/50'
                      : isDark ? 'bg-slate-800' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}

        {/* Step Content with Transitions */}
        <div className="flex-1 overflow-y-auto relative">
          <div
            className={`min-h-full flex flex-col transition-all duration-250 ease-in-out ${
              isTransitioning
                ? slideDirection === 'left'
                  ? '-translate-x-8 opacity-0'
                  : 'translate-x-8 opacity-0'
                : 'translate-x-0 opacity-100'
            }`}
          >
            {renderStep()}
          </div>
        </div>
      </div>
    </div>
  );
};
