
import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { userService, isExistingMerchantProfile } from './services/userService';
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
  MapPin,
} from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { locationsearchService } from './services/locationsearchService';
import { supabase, updateSupabaseSession } from './services/supabaseClient';

const COUNTRY_CODES = [
  { code: "+91", country: "India", flag: "\u{1F1EE}\u{1F1F3}" },
  { code: "+1", country: "USA", flag: "\u{1F1FA}\u{1F1F8}" },
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
  detectedHomeLocation: string | null;
  detectedLocationState: string | null;
  allowLocation: boolean;
  inviteCode?: string | null;
}

export const AuthStack: React.FC<AuthStackProps> = ({ view, setView, setUser, loading, setLoading, registrationMessage, setRegistrationMessage, theme, detectedHomeLocation, detectedLocationState, allowLocation, inviteCode }) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [staffInviteCode, setStaffInviteCode] = useState('');
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPhoneNumber, setOtpPhoneNumber] = useState('');
  const [isPhoneVerifiedForLogin, setIsPhoneVerifiedForLogin] = useState(false);

  // Biometric consent phase: shown AFTER successful OTP + login
  const [loginPhase, setLoginPhase] = useState<'phone' | 'biometric_consent'>('phone');
  const [pendingUser, setPendingUser] = useState<any>(null);

  const { setLocale, locale } = useTranslation();
  const isDark = theme === 'dark';

  // Background location detection state
  const [bgLocationCity, setBgLocationCity] = useState<string | null>(detectedHomeLocation || null);
  const [bgLocationState, setBgLocationState] = useState<string | null>(detectedLocationState || null);
  const [bgLocationLoading, setBgLocationLoading] = useState(false);
  const bgLocationAttempted = React.useRef(false);

  // Background location detection — runs once when login screen appears
  useEffect(() => {
    if (view !== 'login' || bgLocationAttempted.current) return;
    if (detectedHomeLocation && detectedHomeLocation.length > 0) return;
    if (!allowLocation) return;
    bgLocationAttempted.current = true;
    setBgLocationLoading(true);

    const detect = async () => {
      try {
        const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
        const { latitude, longitude } = position.coords;
        const geoResult = await locationsearchService.reverseGeocodeCoordinates(latitude, longitude);
        if (geoResult?.city) {
          setBgLocationCity(geoResult.city);
          setBgLocationState(geoResult.state || null);
          if ((window as any).__dealpro_onLocationDetected) {
            (window as any).__dealpro_onLocationDetected(geoResult.city, geoResult.state || '');
          }
          console.log('[AuthStack] Background location detected:', geoResult.city, geoResult.state);
        }
      } catch (err) {
        console.log('[AuthStack] Background location detection skipped:', err);
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
          });
          const geoResult = await locationsearchService.reverseGeocodeCoordinates(pos.coords.latitude, pos.coords.longitude);
          if (geoResult?.city) {
            setBgLocationCity(geoResult.city);
            setBgLocationState(geoResult.state || null);
            if ((window as any).__dealpro_onLocationDetected) {
              (window as any).__dealpro_onLocationDetected(geoResult.city, geoResult.state || '');
            }
            console.log('[AuthStack] Background location (browser fallback):', geoResult.city, geoResult.state);
          }
        } catch {
          console.log('[AuthStack] Browser location fallback also failed');
        }
      } finally {
        setBgLocationLoading(false);
      }
    };

    detect();
  }, [view, detectedHomeLocation]);

  // Check if merchant has completed core signup (store_name + full_name)
  const isMerchantProfileComplete = async (profile: any): Promise<boolean> => {
    const profileOk = !!(profile.full_name && profile.store_name);
    if (!profileOk) return false;

    // Also verify merchant has at least one store in DB
    try {
      const { count } = await supabase
        .from('merchant_stores')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', profile.id);
      return (count ?? 0) > 0;
    } catch {
      return false;
    }
  };

  const handlePostLoginNavigation = async (userProfile: any, session: any, loginSubscription?: any) => {
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

    let subscriptionInfo: { hasActiveSubscription: boolean; subscription_status?: string; current_tier_id?: number; trialExpired?: boolean; storeCount?: number } = {
      hasActiveSubscription: false
    };
    if (userRole === 'merchant') {
      // Use subscription data from login response if available (avoids auth timing issues)
      if (loginSubscription?.hasActiveSubscription !== undefined) {
        console.log('[AuthStack] Using subscription info from login response:', JSON.stringify(loginSubscription));
        subscriptionInfo = loginSubscription;
      } else {
        console.log('[AuthStack] No subscription in login response, trying edge function...');
        try {
          subscriptionInfo = await merchantSubscriptionService.checkActiveSubscription(userProfile.id, session.access_token);
        } catch {
          console.warn('[AuthStack] Edge function check failed');
        }
      }
    }

    // A merchant has only completed onboarding when ALL of the wizard's
    // required fields are populated. The old check just looked for full_name +
    // store_name — which broke for partial-completion cases: a merchant who
    // filled their name + store name then closed the app would get sent
    // straight to the dashboard on next login, skipping business_type, terms,
    // privacy, etc. (see e.g. Sapna / 9591132539).
    //
    // The onboarding wizard has resume-from-step logic in MerchantOnboarding.tsx,
    // so it's safe to route a partially-complete profile back into the wizard —
    // they pick up from the first missing field.
    //
    // IMPORTANT: routing is decided PURELY from the DB profile (the login
    // response), never from a device-local flag. We previously OR'd in a
    // localStorage "signup complete" cache here as an optimization — but that
    // flag is keyed by the (stable) merchant UUID and persists across DB
    // resets, so on any device where the flag was set but the DB row is empty
    // (wiped test data, different DB), the merchant got routed straight past
    // onboarding to the dashboard. The wizard then never ran and every
    // mandatory field (full_name, store_name, business_type, terms, privacy,
    // GST/Udyam) stayed null forever. The DB is the only source of truth.
    // Existing/established merchant → skip the wizard. Complete core profile OR
    // already established (active subscription and/or ≥1 store). The "established"
    // fallback ensures a reinstall never traps a real merchant back in onboarding
    // just because a legacy DB row is missing business_type/terms/privacy.
    const isExistingMerchant = isExistingMerchantProfile(userProfile, subscriptionInfo);
    const profileOk = isExistingMerchant;

    // Check if this user is a staff member (not the owner) — they skip onboarding entirely
    const isStaffMember = userProfile.staff_role && userProfile.staff_role !== 'owner';
    console.log('[AuthStack] Post-login — isExistingMerchant:', isExistingMerchant, 'profileOk:', profileOk, 'isStaffMember:', isStaffMember, 'staff_role:', userProfile.staff_role,
      'fields:', { full_name: !!userProfile.full_name, store_name: !!userProfile.store_name, category: !!userProfile.category, business_type: !!userProfile.business_type, terms: !!userProfile.terms_accepted, privacy: !!userProfile.privacy_accepted });

    const updatedUser = {
      ...userProfile,
      isLoggedIn: true,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      hasActiveSubscription: subscriptionInfo.hasActiveSubscription,
      subscription_status: subscriptionInfo.subscription_status,
      current_tier_id: subscriptionInfo.current_tier_id,
      trialExpired: subscriptionInfo.trialExpired || false,
      storeCount: subscriptionInfo.storeCount,
    };

    // Determine target view
    let targetView: string;
    if (userRole === 'merchant') {
      if (isStaffMember) {
        // Staff members go straight to dashboard — no onboarding or subscription checks
        console.log('[AuthStack] Staff member detected, skipping onboarding → dashboard');
        updatedUser.hasActiveSubscription = true; // staff inherits owner's subscription
        targetView = 'merchant_dashboard';
      } else if (!subscriptionInfo.hasActiveSubscription) {
        if (profileOk) {
          // Profile complete but NO active subscription/trial → send to the plan
          // picker, NOT the dashboard. The old hack here force-set
          // hasActiveSubscription=true and routed to the dashboard, letting
          // unsubscribed merchants in (and create deals) — a gate bypass.
          console.log('[AuthStack] Profile complete but no active subscription — routing to subscription selection');
          targetView = 'merchant_subscriptions';
        } else {
          console.log('[AuthStack] No active subscription — forcing subscription selection');
          targetView = 'merchant_onboarding';
        }
      } else {
        if (!profileOk) {
          // Truly new merchant — hasn't completed basic profile yet
          targetView = 'merchant_onboarding';
          localStorage.removeItem(`merchant_onboarding_draft_${userProfile.id}`);
        } else {
          // Existing merchant — go to dashboard. If they have no stores,
          // the store gate in MerchantStack will handle it.
          targetView = 'merchant_dashboard';
        }
      }
    } else {
      targetView = 'onboarding';
    }

    // Snapshot these BEFORE the unconditional save below — saveSession makes
    // getSavedUser() truthy, which would otherwise hide the first-time screen.
    const alreadyAsked = localStorage.getItem('dealpro_merchant_biometric_asked') === 'true';
    const alreadyOptedIn = !!biometricService.getSavedUser();

    // Persist the session UNCONDITIONALLY. Goal: once a merchant has signed in on
    // this device, they must never have to enter an OTP again. The saved session
    // (phone + tokens) is what App.tsx's splash restore + cached-phone silent
    // re-auth rely on. Previously this was gated on the "Quick Login" choice, so
    // merchants who tapped "Not Now" (or had already been asked once) were never
    // remembered and got OTP-prompted on every cold open. Persistence is no longer
    // a function of that choice — the consent screen below is now purely UX.
    await biometricService.saveSession(updatedUser);

    if (alreadyOptedIn || alreadyAsked) {
      setUser(updatedUser);
      setView(targetView as AppView);
    } else {
      // First login on this device — show the quick-login consent screen once.
      // The session is already saved above regardless of what they choose.
      setPendingUser({ user: updatedUser, targetView });
      setLoginPhase('biometric_consent');
    }
  };

  // User accepted quick login
  const handleBiometricAccept = async () => {
    if (!pendingUser) return;
    localStorage.setItem('dealpro_merchant_biometric_asked', 'true');
    await biometricService.saveSession(pendingUser.user);

    // Establish Supabase session BEFORE navigating — prevents blank screen
    // where dashboard components try to fetch data without a valid session.
    if (pendingUser.user.access_token && pendingUser.user.refresh_token) {
      await updateSupabaseSession({
        access_token: pendingUser.user.access_token,
        refresh_token: pendingUser.user.refresh_token,
        user: { id: pendingUser.user.id, email: pendingUser.user.email, user_metadata: { role: pendingUser.user.role } } as any,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });
    }

    setUser(pendingUser.user);
    const targetView = pendingUser.targetView;
    setPendingUser(null);
    setLoginPhase('phone');
    setView(targetView as AppView);
  };

  // User declined quick login
  const handleBiometricDecline = async () => {
    if (!pendingUser) return;
    localStorage.setItem('dealpro_merchant_biometric_asked', 'true');
    // Declining "Quick Login" must NOT log you out of the device — the session
    // was already saved in handlePostLoginNavigation, but re-save defensively so
    // this path can never strand a merchant back into the OTP flow.
    await biometricService.saveSession(pendingUser.user);

    // Establish Supabase session BEFORE navigating
    if (pendingUser.user.access_token && pendingUser.user.refresh_token) {
      await updateSupabaseSession({
        access_token: pendingUser.user.access_token,
        refresh_token: pendingUser.user.refresh_token,
        user: { id: pendingUser.user.id, email: pendingUser.user.email, user_metadata: { role: pendingUser.user.role } } as any,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });
    }

    setUser(pendingUser.user);
    const targetView = pendingUser.targetView;
    setPendingUser(null);
    setLoginPhase('phone');
    setView(targetView as AppView);
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

      // Skip session restore if a login is already in progress (e.g., OTP just verified)
      // This prevents a duplicate handlePostLoginNavigation call that lacks staff_role
      if (loading || isPhoneVerifiedForLogin || phoneNumber) return;

      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
          const userProfile = await userService.getUserProfile(session.user.id);
          if (userProfile) {
            // Check if this user is a staff member — enrich profile with staff data
            const savedSession = biometricService.getSavedUser();
            if (savedSession?.staff_role) {
              userProfile.staff_role = savedSession.staff_role;
              userProfile.staff_merchant_id = savedSession.staff_merchant_id;
              // Copy owner's profile data from saved session
              if (savedSession.store_name) userProfile.store_name = savedSession.store_name;
              if (savedSession.full_name) userProfile.full_name = savedSession.full_name;
              if (savedSession.category) userProfile.category = savedSession.category;
              if (savedSession.business_type) userProfile.business_type = savedSession.business_type;
              if (savedSession.terms_accepted) userProfile.terms_accepted = savedSession.terms_accepted;
              if (savedSession.privacy_accepted) userProfile.privacy_accepted = savedSession.privacy_accepted;
            }
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
    const effectiveInviteCode = staffInviteCode.trim() || inviteCode || undefined;
    const { user: userProfile, session, subscription } = await userService.merchantOtpLogin(phone, selectedCountry.code, effectiveInviteCode);
    if (!userProfile) throw new Error('Unable to load your account. Please try again.');
    if (!session) throw new Error('Login could not be completed. Please try again.');
    await handlePostLoginNavigation(userProfile, session, subscription);
  };

  const completeAuth = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const cleanDigits = phoneNumber.replace(/\D/g, '');
      try {
        await doOtpLogin(cleanDigits);
      } catch (loginErr: any) {
        // If login fails (user not found), try registering then login again
        const loginMsg = loginErr.message?.toLowerCase() || '';
        console.log('[AuthStack] Login failed, attempting registration fallback. Error:', loginMsg);
        try {
          await userService.registerUser({
            phone: cleanDigits,
            country_code: selectedCountry.code,
            role: 'merchant',
            languagePreference: locale,
            home_location: detectedHomeLocation || undefined,
            location_state: detectedLocationState || undefined,
            allow_location: allowLocation,
          });
          await doOtpLogin(cleanDigits);
        } catch (regErr) {
          // Both login and registration failed — throw the original login error
          throw loginErr;
        }
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('network')) {
        setAuthError('Unable to connect to server. Please check your internet connection.');
      } else {
        setAuthError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    const input = phoneNumber.trim();
    if (!input) return;

    const cleanDigits = input.replace(/\D/g, '');

    const TEST_NUMBERS = ['9999999999', '8888888888', '6666666666', '7777777777', '4444444444', '5555555555', '3333333333', '2222222222', '1111111111'];
    if (selectedCountry.code === '+91' && !TEST_NUMBERS.includes(cleanDigits)) {
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

    // Test numbers go through the SAME OTP modal as real numbers (fixed code
    // 123456, no SMS) so the login flow is identical and reviewable. The modal's
    // onVerificationSuccess sets isPhoneVerifiedForLogin(true) — exactly what the
    // old instant-bypass did — so the login outcome is unchanged.
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
          Allow Sreshta to use your device's biometric authentication (fingerprint / face) to sign you in instantly next time.
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
      <div className={`px-6 pt-8 pb-safe-bottom flex flex-col ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
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

          {/* Background location indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-3 min-h-[20px]">
            {bgLocationLoading && (
              <>
                <Loader2 className={`w-3 h-3 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Detecting location...</span>
              </>
            )}
            {!bgLocationLoading && bgLocationCity && (
              <>
                <MapPin className="w-3 h-3 text-emerald-500" />
                <span className={`text-[11px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {bgLocationCity}{bgLocationState ? `, ${bgLocationState}` : ''}
                </span>
              </>
            )}
          </div>

          {/* Build stamp — visible before signup even starts, so a tester can read
              the exact WEB build they're on. Catches a stale APK at a glance. */}
          <p className={`mt-4 text-center text-[9px] tracking-wide ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Build {__BUILD_ID__}
          </p>
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
