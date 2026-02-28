
import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { userService } from './services/userService';
import { biometricService } from './services/biometricService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { fcmService } from './services/fcmService';
import { useTranslation } from './contexts/LanguageContext';
import { OtpVerificationModal } from './OtpVerificationModal';
import {
  Loader2,
  CheckCircle2,
  ShieldAlert,
  ChevronDown,
  Fingerprint,
  ShieldCheck,
} from 'lucide-react';
import { supabase, updateSupabaseSession } from './services/supabaseClient';

const COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "+1", country: "USA", flag: "\u{1F1FA}\u{1F1F8}" },
  { code: "+44", country: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
  { code: "+971", country: "UAE", flag: "\u{1F1E6}\u{1F1EA}" },
];

interface AuthStackProps {
  view: AppView;
  setView: (view: AppView) => void;
  setUser: (user: any) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  registrationMessage: string | null;
  setRegistrationMessage: (msg: string | null) => void;
  theme: 'light' | 'dark';
}

export const AuthStack: React.FC<AuthStackProps> = ({ view, setView, setUser, loading, setLoading, registrationMessage, setRegistrationMessage, theme }) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPhoneNumber, setOtpPhoneNumber] = useState('');
  const [isPhoneVerifiedForLogin, setIsPhoneVerifiedForLogin] = useState(false);

  // Biometric consent phase: shown AFTER successful OTP + login
  const [loginPhase, setLoginPhase] = useState<'phone' | 'biometric_consent'>('phone');
  const [pendingUser, setPendingUser] = useState<any>(null);

  const { setLocale } = useTranslation();
  const isDark = theme === 'dark';

  // Check if merchant has completed their profile (onboarding wizard)
  const isMerchantProfileComplete = (profile: any): boolean => {
    return !!(
      profile.full_name &&
      profile.store_name &&
      profile.business_type &&
      profile.terms_accepted &&
      profile.privacy_accepted
    );
  };

  const handlePostLoginNavigation = async (userProfile: any, session: any) => {
    await updateSupabaseSession(session);
    const userRole = userProfile.role || 'merchant';

    if (userProfile.lang_preference) {
      setLocale(userProfile.lang_preference);
    }

    try {
      await fcmService.initialize(userProfile.id);
    } catch (error) {
      console.error('[AuthStack] Failed to initialize push notifications:', error);
    }

    let subscriptionInfo: { hasActiveSubscription: boolean; subscription_status?: string; current_tier_id?: number } = {
      hasActiveSubscription: false
    };
    if (userRole === 'merchant') {
      subscriptionInfo = await merchantSubscriptionService.checkActiveSubscription(userProfile.id);
    }

    const updatedUser = {
      ...userProfile,
      isLoggedIn: true,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      hasActiveSubscription: subscriptionInfo.hasActiveSubscription,
      subscription_status: subscriptionInfo.subscription_status,
      current_tier_id: subscriptionInfo.current_tier_id,
    };

    // Determine target view: if merchant profile is incomplete, show onboarding wizard
    // Subscription selection is part of onboarding, so complete profile → dashboard
    let targetView: string;
    if (userRole === 'merchant') {
      if (!isMerchantProfileComplete(userProfile)) {
        targetView = 'merchant_onboarding';
      } else {
        targetView = 'merchant_dashboard';
      }
    } else if (userRole === 'dealadmin') {
      targetView = 'dealadmin_review_deals';
    } else {
      targetView = 'onboarding';
    }

    // Check if user already opted in/out of biometric
    const alreadyAsked = localStorage.getItem('dealpro_merchant_biometric_asked') === 'true';
    const alreadyOptedIn = !!biometricService.getSavedUser();

    if (alreadyOptedIn) {
      await biometricService.saveSession(updatedUser);
      setUser(updatedUser);
      setView(targetView as AppView);
    } else if (alreadyAsked) {
      setUser(updatedUser);
      setView(targetView as AppView);
    } else {
      // First time — show biometric consent screen
      setPendingUser({ user: updatedUser, targetView });
      setLoginPhase('biometric_consent');
    }
  };

  // User accepted quick login
  const handleBiometricAccept = async () => {
    if (!pendingUser) return;
    localStorage.setItem('dealpro_merchant_biometric_asked', 'true');
    await biometricService.saveSession(pendingUser.user);
    setUser(pendingUser.user);
    setPendingUser(null);
    setLoginPhase('phone');
    setView(pendingUser.targetView as AppView);
  };

  // User declined quick login
  const handleBiometricDecline = () => {
    if (!pendingUser) return;
    localStorage.setItem('dealpro_merchant_biometric_asked', 'true');
    setUser(pendingUser.user);
    setPendingUser(null);
    setLoginPhase('phone');
    setView(pendingUser.targetView as AppView);
  };

  useEffect(() => {
    if (view === 'login') {
      if (registrationMessage) {
        setSuccessMessage(registrationMessage);
        setRegistrationMessage(null);
      }

      // Skip Supabase session check if biometric login will handle it (App.tsx)
      // This prevents a race condition where the async session check overrides
      // the biometric path's navigation after AuthStack unmounts
      if (biometricService.getSavedUser()) return;

      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
          const userProfile = await userService.getUserProfile(session.user.id);
          if (userProfile) {
            handlePostLoginNavigation(userProfile, session);
          } else {
            await biometricService.clearSession();
            setAuthError("Your account could not be found. Please log in again.");
          }
        }
      }).catch(err => {
        console.error("Error restoring session:", err);
        setAuthError("Your previous session has expired. Please log in again.");
      });
    }
  }, [view, setUser, setView, setLoading, registrationMessage, setRegistrationMessage]);

  // After OTP verified → complete login
  useEffect(() => {
    if (isPhoneVerifiedForLogin && phoneNumber) {
      setIsPhoneVerifiedForLogin(false);
      completeAuth();
    }
  }, [isPhoneVerifiedForLogin, phoneNumber]);

  const doOtpLogin = async (phone: string) => {
    const { user: userProfile, session } = await userService.merchantOtpLogin(phone, selectedCountry.code);
    if (!userProfile) throw new Error('Unable to load your account. Please try again.');
    if (!session) throw new Error('Login could not be completed. Please try again.');
    await handlePostLoginNavigation(userProfile, session);
  };

  const completeAuth = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const cleanDigits = phoneNumber.replace(/\D/g, '');
      await doOtpLogin(cleanDigits);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
        setAuthError('Unable to connect to server. Please check your internet connection.');
      } else {
        setAuthError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    const input = phoneNumber.trim();
    if (!input) return;

    const cleanDigits = input.replace(/\D/g, '');

    if (selectedCountry.code === '+91') {
      if (cleanDigits.length !== 10 || !/^[6-9]/.test(cleanDigits)) {
        setAuthError('Please enter a valid 10-digit phone number.');
        return;
      }
    } else {
      if (cleanDigits.length < 4 || cleanDigits.length > 15) {
        setAuthError('Please enter a valid phone number.');
        return;
      }
    }

    setAuthError(null);
    setPhoneNumber(cleanDigits);

    // Test bypass — skip OTP for test numbers
    if (['9999999999', '8888888888', '6666666666', '7777777777'].includes(cleanDigits)) {
      setIsPhoneVerifiedForLogin(true);
      return;
    }

    const fullPhone = `${selectedCountry.code}${cleanDigits}`;
    setOtpPhoneNumber(fullPhone);
    setShowOtpModal(true);
  };

  const phoneMaxLength = selectedCountry.code === '+91' ? 10 : 15;
  const isPhoneValid = (() => {
    const digits = phoneNumber.replace(/\D/g, '');
    if (selectedCountry.code === '+91') return digits.length === 10;
    return digits.length >= 4;
  })();

  // Biometric consent screen — shown after successful OTP + login
  if (loginPhase === 'biometric_consent') {
    return (
      <div className={`px-6 pt-10 flex flex-col items-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center mb-6">
          <Fingerprint className="w-10 h-10 text-emerald-600" />
        </div>

        <h2 className={`text-2xl font-semibold mb-3 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Enable Quick Login?
        </h2>

        <p className={`text-sm text-center mb-8 leading-relaxed max-w-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Allow DealPro to use your device's biometric authentication (fingerprint / face) to sign you in instantly next time.
        </p>

        <div className={`w-full rounded-xl p-4 mb-8 ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
          <div className="flex items-start gap-3 mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Your data stays on-device</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                Biometric data is never sent to our servers. Authentication is handled entirely by your device.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Skip OTP next time</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                Open the app and go straight to your dashboard — no phone verification needed.
              </p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-3">
          <button
            onClick={handleBiometricAccept}
            className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Fingerprint className="w-4 h-4" />
            Yes, Enable Quick Login
          </button>
          <button
            onClick={handleBiometricDecline}
            className={`w-full h-12 rounded-xl text-sm font-medium active:scale-[0.98] transition-all ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Not Now
          </button>
        </div>

        <p className={`text-[10px] mt-6 text-center px-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          You can change this later in Settings. We respect your privacy.
        </p>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className={`px-6 pt-8 flex flex-col ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className="w-full text-left mb-8">
          <h2 className={`text-2xl font-semibold leading-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Partner Success
          </h2>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Create, manage, and track your exclusive deals in real-time.</p>
        </div>

        {successMessage && (
          <div className={`mb-5 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border border-emerald-200 text-emerald-600'}`}>
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Modal */}
        {authError && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-8">
            <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Login Error</h3>
              </div>
              <p className={`text-sm mb-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {authError}
              </p>
              <button
                onClick={() => setAuthError(null)}
                className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all"
              >
                OK
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4 flex-1">
          {/* Phone entry with country code */}
          <div className="relative flex">
            {/* Country Code Picker */}
            <div className={`relative ${showCountryPicker ? 'z-[1000]' : ''}`}>
              <button
                type="button"
                onClick={() => setShowCountryPicker(!showCountryPicker)}
                className={`h-12 w-[72px] rounded-l-lg border flex items-center justify-center gap-1 active:scale-95 transition-all focus:outline-none ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-lg">{selectedCountry.flag}</span>
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </button>
              {showCountryPicker && (
                <div className={`absolute top-full left-0 mt-2 w-48 rounded-lg p-2 z-[999] shadow-lg border ${
                  isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                }`}>
                  <div className="max-h-48 overflow-y-auto">
                    {COUNTRY_CODES.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => { setSelectedCountry(c); setShowCountryPicker(false); }}
                        className={`w-full text-left p-3 rounded-lg text-xs font-medium flex gap-3 items-center ${
                          isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span>{c.flag}</span>
                        <span className={`flex-1 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{c.country}</span>
                        <span className="text-slate-500">{c.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Phone Input */}
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
              placeholder={`Phone Number${selectedCountry.code === '+91' ? ' (10 Digits)' : ''}`}
              type="tel"
              maxLength={phoneMaxLength}
              inputMode="numeric"
              className={`flex-1 h-12 px-4 rounded-r-lg text-sm font-medium outline-none transition-all border border-l-0 ${
                isDark
                  ? 'bg-slate-800 text-white placeholder-slate-500 border-slate-700 focus:border-slate-500'
                  : 'bg-white text-slate-900 placeholder-slate-400 border-slate-200 focus:border-slate-400'
              }`}
              autoFocus
            />
          </div>

          {/* Terms of Service and Privacy Policy Notice */}
          <div className="text-center px-2">
            <p className={`text-[10px] leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
              By continuing, you agree to our{' '}
              <button
                onClick={() => setView('terms_of_service')}
                className={`underline ${isDark ? 'text-blue-400' : 'text-blue-600'} transition-colors`}
              >
                Terms of Service
              </button>{' '}
              and acknowledge that you have read our{' '}
              <button
                onClick={() => setView('privacy_policy')}
                className={`underline ${isDark ? 'text-blue-400' : 'text-blue-600'} transition-colors`}
              >
                Privacy Policy
              </button>{' '}
              to learn how we collect, use and share your data.
            </p>
          </div>

          <button
            onClick={handleContinue}
            disabled={loading || !isPhoneValid}
            className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Continue'}
          </button>
        </div>

        {/* Login OTP Modal */}
        <OtpVerificationModal
          isOpen={showOtpModal}
          onClose={() => {
            setShowOtpModal(false);
            setOtpPhoneNumber('');
          }}
          phoneNumber={otpPhoneNumber}
          onVerificationSuccess={() => {
            setShowOtpModal(false);
            setIsPhoneVerifiedForLogin(true);
          }}
          onVerificationError={() => {
            setIsPhoneVerifiedForLogin(false);
          }}
        />
      </div>
    );
  }

  return null;
};
