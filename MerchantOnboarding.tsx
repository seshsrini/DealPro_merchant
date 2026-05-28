import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { AppView, StoreLocation, User } from './types';
import { merchantOnboardingService } from './services/merchantOnboardingService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { encryptionService, auditLogger } from './services/encryptionService';
import { biometricService } from './services/biometricService';
import { signupDraftService } from './services/draftService';
import { Loader2 } from 'lucide-react';

// Step components
import { StepWelcome } from './components/merchant-onboarding/StepWelcome';
import { StepFullName } from './components/merchant-onboarding/StepFullName';
import { StepStoreName } from './components/merchant-onboarding/StepStoreName';
import { StepCategory } from './components/merchant-onboarding/StepCategory';
import { StepStoreAddress } from './components/merchant-onboarding/StepStoreAddress';
import { StepAddMoreStores } from './components/merchant-onboarding/StepAddMoreStores';
import { StepBusinessVerification } from './components/merchant-onboarding/StepBusinessVerification';
import { StepTermsOfService } from './components/merchant-onboarding/StepTermsOfService';
import { StepPrivacyPolicy } from './components/merchant-onboarding/StepPrivacyPolicy';
import { StepReviewDetails } from './components/merchant-onboarding/StepReviewDetails';
import { StepSubscription } from './components/merchant-onboarding/StepSubscription';
import { StepLoyaltyAddon } from './components/merchant-onboarding/StepLoyaltyAddon';
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
  | { type: 'UPDATE_STORE'; index: number; field: keyof StoreLocation; value: any }
  | { type: 'RESTORE_DRAFT'; draft: WizardState };

const createEmptyStore = (): StoreLocation => ({
  store_name: '', street: '', pincode: '', locality: '', state: '', city: '',
  landmark: '', store_category: '', store_phone: '', store_phone_alt: '',
  coords: null, isGeocoding: false,
  shift1: '9:00 AM', shift2: '10:00 PM', is24hrs: false, isPincodeSearching: false,
  delivers: false, delivery_radius_km: null,
});

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
  'Verification', 'Review', 'Terms', 'Privacy', 'Plan', 'Loyalty', 'Done',
];
const TOTAL_STEPS = STEP_LABELS.length;

// --- Component ---
interface MerchantOnboardingProps {
  setView: (view: AppView) => void;
  user: User;
  setUser: (user: User) => void;
  theme: 'light' | 'dark';
}

export const MerchantOnboarding: React.FC<MerchantOnboardingProps> = ({
  setView, user, setUser, theme,
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
    if (user.store_name) dispatch({ type: 'SET_FIELD', field: 'storeName', value: user.store_name });
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
    if (returnToReview && currentStep !== 7) {
      // When editing from review, "Back" returns to review instead of previous step
      setReturnToReview(false);
      goToStep(7);
      return;
    }
    if (currentStep <= 0) return; // Don't go before welcome
    goToStep(currentStep - 1);
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
    goToStep(4); // Go back to address step for new store
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
        category: filteredStores.length > 1 ? 'multiple' : 'single',
        business_type: state.businessType,
        terms_accepted: true,
        privacy_accepted: true,
      };
      setUser(updatedUser);

      // Re-save biometric session so app reopen sees complete profile
      await biometricService.saveSession(updatedUser);

      // Skip subscription step if merchant already has an active subscription
      if (user.hasActiveSubscription) {
        goToStep(12); // Congrats
      } else {
        goToStep(10); // Subscription selection
      }
    } catch (err: any) {
      console.error('[MerchantOnboarding] Submit error:', err);
      setSubmitError('Unable to save profile. Please try again.');
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
  // subscription. The Razorpay payment now happens in StepLoyaltyAddon (next
  // step), where the loyalty add-on can be bundled into the charge.
  //
  // Exception: when a subscription was already created synchronously
  // (alreadyActive=true — dev test bypass / legacy trial path), skip the
  // loyalty + payment step entirely so the merchant doesn't get charged
  // twice. The user can manage the loyalty add-on later from the
  // subscriptions screen.
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
    goToStep(11); // Loyalty step (where Razorpay is taken).
  };

  const handleLoyaltyComplete = () => {
    localStorage.removeItem(DRAFT_KEY);
    goToStep(12); // Congrats
  };

  // Congrats → go to dashboard
  const handleGoToDashboard = () => {
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
          />
        );
      case 3:
        return (
          <StepCategory
            value={state.category}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'category', value: v })}
            onNext={handleNext}
            onBack={returnToReview ? undefined : handleBack}
            theme={theme}
          />
        );
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
            onNext={handleNext}
            onBack={returnToReview ? undefined : handleBack}
            theme={theme}
          />
        );
      case 6:
        return (
          <StepBusinessVerification
            businessType={state.businessType}
            gstinValue={state.gstinValue}
            panValue={state.panValue}
            udyamValue={state.udyamValue}
            fssaiValue={state.fssaiValue}
            tradeLicenseValue={state.tradeLicenseValue}
            onChangeType={(v) => dispatch({ type: 'SET_FIELD', field: 'businessType', value: v })}
            onChangeField={(field, value) => dispatch({ type: 'SET_FIELD', field: field as keyof WizardState, value })}
            onNext={handleNext}
            onBack={returnToReview ? undefined : handleBack}
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
          <StepLoyaltyAddon
            user={user}
            subscriptionFee={lastSubscriptionFee}
            tierKey={lastTierKey}
            onComplete={handleLoyaltyComplete}
            theme={theme}
          />
        );
      case 12:
        return (
          <StepCongrats
            storeName={state.storeName}
            onGoToDashboard={handleGoToDashboard}
            theme={theme}
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
