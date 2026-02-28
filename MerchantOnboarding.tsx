import React, { useState, useEffect, useReducer, useCallback } from 'react';
import { AppView, StoreLocation, User } from './types';
import { merchantOnboardingService } from './services/merchantOnboardingService';
import { encryptionService, auditLogger } from './services/encryptionService';
import { biometricService } from './services/biometricService';
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
import { StepCongrats } from './components/merchant-onboarding/StepCongrats';

// --- Types ---
type BusinessType = '' | 'gstin' | 'udyam' | 'fssai' | 'trade_license';

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
  landmark: '', coords: null, isGeocoding: false, shift1: '9:00 AM', shift2: '10:00 PM',
  is24hrs: false, isPincodeSearching: false,
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
  'Welcome', 'Name', 'Store', 'Category', 'Address', 'Stores',
  'Verification', 'Review', 'Terms', 'Privacy', 'Plan', 'Done',
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

  const DRAFT_KEY = `merchant_onboarding_draft_${user.id}`;

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && draft.fullName !== undefined) {
          dispatch({ type: 'RESTORE_DRAFT', draft });
        }
      }
    } catch {}
  }, [DRAFT_KEY]);

  // Save draft
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch {}
  }, [DRAFT_KEY, state]);

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
      goToStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (returnToReview && currentStep !== 7) {
      setReturnToReview(false); // Cancel return-to-review if user navigates back
    }
    goToStep(currentStep - 1);
  };

  const handleEditFromReview = (targetStep: number) => {
    setReturnToReview(true);
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

      await merchantOnboardingService.completeMerchantProfile({
        userId: user.id,
        fullName: state.fullName,
        storeName: state.storeName,
        category: state.category,
        businessType: state.businessType,
        gstin: encryptedGstin,
        pan: encryptedPan,
        udyamNo: state.businessType === 'udyam' ? state.udyamValue.toUpperCase() : null,
        fssaiNo: state.businessType === 'fssai' ? state.fssaiValue : null,
        tradeLicenseNo: state.businessType === 'trade_license' ? state.tradeLicenseValue.toUpperCase() : null,
        termsAccepted: true,
        privacyAccepted: true,
        stores: state.stores.map(s => ({
          store_name: s.store_name || state.storeName,
          address: s.street,
          pincode: s.pincode,
          locality: s.locality,
          city: s.city,
          state: s.state,
          landmark: s.landmark,
          latitude: s.coords?.latitude || 0,
          longitude: s.coords?.longitude || 0,
          store_hrs: s.is24hrs ? 'Open 24 Hours' : `${s.shift1} - ${s.shift2}`,
        })),
      });

      // Clear draft
      localStorage.removeItem(DRAFT_KEY);

      // Update user state with ALL profile-completeness fields
      const updatedUser = {
        ...user,
        full_name: state.fullName,
        store_name: state.storeName,
        category: state.category,
        business_type: state.businessType,
        terms_accepted: true,
        privacy_accepted: true,
      };
      setUser(updatedUser);

      // Re-save biometric session so app reopen sees complete profile
      await biometricService.saveSession(updatedUser);

      // Move to subscription step
      goToStep(10);
    } catch (err: any) {
      console.error('[MerchantOnboarding] Submit error:', err);
      setSubmitError(err.message || 'Failed to save profile. Please try again.');
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

  // Subscription complete → show congrats
  const handleSubscriptionComplete = async () => {
    localStorage.removeItem(DRAFT_KEY);
    // Re-save biometric session with subscription info
    await biometricService.saveSession(user);
    goToStep(11);
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
            onBack={handleBack}
            theme={theme}
          />
        );
      case 2:
        return (
          <StepStoreName
            value={state.storeName}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'storeName', value: v })}
            onNext={handleNext}
            onBack={handleBack}
            theme={theme}
          />
        );
      case 3:
        return (
          <StepCategory
            value={state.category}
            onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'category', value: v })}
            onNext={handleNext}
            onBack={handleBack}
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
            onBack={handleBack}
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
            onBack={handleBack}
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
            onBack={handleBack}
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
          />
        );
      case 11:
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
