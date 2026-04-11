import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppView, User, Deal } from './types'; // Import User type
import { biometricService } from './services/biometricService';
import { AuthStack } from './AuthStack';
import { MemberJoin } from './memberJoin';
import { MerchantStack } from './MerchantStack';
import { LanguageProvider } from './contexts/LanguageContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { LanguageSelection } from './components/LanguageSelection';
import { LocationPermission } from './components/LocationPermission';
import { InviteCodeScreen } from './components/InviteCodeScreen';
import { Header, MerchantBottomNav } from './components/Navigation';
import { MerchantOnboarding } from './MerchantOnboarding';
import { QRscan } from './QRscan';
import { supabase, updateSupabaseSession } from './services/supabaseClient';
import { userService } from './services/userService';
import { addCampaignService } from './services/addCampaignService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { OtpVerificationModal } from './OtpVerificationModal';
import { TrendingUp, BarChart3, Zap } from 'lucide-react';
import { PrivacyPolicy } from './PrivacyPolicy'; // Privacy Policy component
import { TermsOfService } from './TermsOfService'; // Terms of Service component
import { PrivacyPolicySignup } from './PrivacyPolicySignup'; // Privacy Policy for signup
import { TermsOfServiceSignup } from './TermsOfServiceSignup'; // Terms of Service for signup

const AppContent: React.FC = () => {
  const [view, setView] = useState<AppView>('splash');
  const [lastListView, setLastListView] = useState<AppView>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [loading, setLoading] = useState(false);
  const [hasBiometricSession, setHasBiometricSession] = useState(false);
  const [dealIdToEdit, setDealIdToEdit] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [preSelectedTab, setPreSelectedTab] = useState<'review' | 'active' | 'expired' | 'needs review' | null>(null);
  const [pendingAuthView, setPendingAuthView] = useState<AppView>('login');

  // Location permission state
  const [detectedHomeLocation, setDetectedHomeLocation] = useState<string | null>(null);
  const [detectedLocationState, setDetectedLocationState] = useState<string | null>(null);
  const [allowLocation, setAllowLocation] = useState(false);

  // Invite code state — set when user enters valid code on InviteCodeScreen
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  // Expose location callback for AuthStack background detection
  useEffect(() => {
    (window as any).__dealpro_onLocationDetected = (city: string, state: string) => {
      setDetectedHomeLocation(city);
      setDetectedLocationState(state || null);
      setAllowLocation(true);
      console.log('[App] Background location detected:', city, state);
    };
    return () => { delete (window as any).__dealpro_onLocationDetected; };
  }, []);

  // User state now correctly initialized with the User interface structure
  const [user, setUser] = useState<User>({
    id: '',
    username: '',
    isLoggedIn: false,
    role: 'consumer', // Default role
    full_name: '', // Added full_name to initial state
    access_token: null,
    refresh_token: null,
    onboarding_complete: false, // Initialize onboarding status
    hasActiveSubscription: false, // Initialize subscription status
  });
  const [deals, setDeals] = useState<Deal[]>([]);

  // OTP Modal State for Merchant Phone Verification during Registration
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpPhoneNumber, setOtpPhoneNumber] = useState('');
  const [isPhoneVerifiedForRegistration, setIsPhoneVerifiedForRegistration] = useState(false);

  // New state for registration success message
  const [registrationSuccessMessage, setRegistrationSuccessMessage] = useState<string | null>(null);

  // Terms and Privacy acceptance state (lifted up from MemberJoin to share with Terms/Privacy pages)
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Role selection state for signup (persist across navigation)
  // Merchant app: always sign up as merchant, no role selector
  const signupRole: 'user' | 'merchant' = 'merchant';
  const setSignupRole = (_: 'user' | 'merchant') => {};
  const showRoleSelector = false;
  const setShowRoleSelector = (_: boolean) => {};

  const unreadNotifications = 0;


  const prevViewRef = useRef<AppView | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const navigateTo = (newView: AppView) => {
    if (['home', 'deals', 'deals_of_day', 'favorites', 'merchant_dashboard', 'merchant_deals', 'profile', 'store_search'].includes(newView)) {
      setLastListView(newView);
    }
    prevViewRef.current = view;
    setView(newView);
  };

  // Scroll to top whenever view changes
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo(0, 0);
  }, [view]);

  // refreshDeals fetches merchant's own campaigns
  const refreshDeals = useCallback(async () => {
    if (!user.isLoggedIn || !user.id || !user.access_token) {
      console.log("[App.tsx refreshDeals] Authentication state incomplete. Aborting fetch.");
      return;
    }
    
    console.log(`[App.tsx refreshDeals] Pulse triggered for User: ${user.id} (${user.role})`);

    try {
      let fetchedDeals: Deal[] = [];
      if (user.role === 'merchant') {
        console.log(`[App.tsx refreshDeals] Invoking 'getMerchantDeals' for ID: ${user.id}`);
        fetchedDeals = await addCampaignService.getMerchantDeals(user.id);
        console.log(`[App.tsx refreshDeals] Pipeline Success: Received ${fetchedDeals.length} campaigns.`);
      }
      
      setDeals(fetchedDeals);
    } catch (err) {
      console.error("[App.tsx refreshDeals] Data pipeline failure:", err);
    }
  }, [user.id, user.role, user.isLoggedIn, user.access_token]); // Removed 'loading' to prevent re-creation loops

  useEffect(() => {
    if (user.id && user.isLoggedIn && view !== 'merchant_onboarding') {
      if (user.role === 'merchant') {
        refreshDeals();
      }
    }
  }, [user.id, user.isLoggedIn, user.role, view, refreshDeals]);

  // Update Supabase client session whenever user.access_token changes
  const wasLoggedInRef = useRef(false);
  const isReAuthenticatingRef = useRef(false);
  useEffect(() => {
    if (user.access_token && user.refresh_token && user.id) {
      wasLoggedInRef.current = true;
      updateSupabaseSession({
        access_token: user.access_token,
        refresh_token: user.refresh_token,
        user: { id: user.id, email: user.email, user_metadata: { role: user.role } } as any,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Date.now() + 3600 * 1000
      }).then(async (success) => {
        if (!success && !isReAuthenticatingRef.current) {
          // Token refresh failed — silently re-authenticate using saved phone.
          // This avoids asking the user for OTP again.
          const savedUser = biometricService.getSavedUser();
          const phone = savedUser?.phone;
          const cc = savedUser?.country_code || '+91';

          if (phone) {
            console.log('[App] Token refresh failed — attempting silent re-auth for:', phone);
            isReAuthenticatingRef.current = true;
            try {
              const { user: freshProfile, session } = await userService.merchantOtpLogin(phone, cc);
              if (freshProfile && session) {
                console.log('[App] Silent re-auth succeeded for:', freshProfile.id);
                const updatedUser = {
                  ...savedUser,
                  ...freshProfile,
                  isLoggedIn: true,
                  access_token: session.access_token,
                  refresh_token: session.refresh_token,
                };
                setUser(updatedUser);
                biometricService.saveSession(updatedUser);
                return; // Success — user stays on current view
              }
            } catch (reAuthErr) {
              console.warn('[App] Silent re-auth failed:', reAuthErr);
            } finally {
              isReAuthenticatingRef.current = false;
            }
          }

          // Silent re-auth failed too — must redirect to login as last resort
          console.warn('[App] All session recovery failed — redirecting to login.');
          biometricService.clearSession();
          setUser({ id: '', username: '', isLoggedIn: false, role: 'consumer', full_name: '', access_token: null, refresh_token: null, onboarding_complete: false, hasActiveSubscription: false } as User);
          setView('login');
        }
      });
    } else if (wasLoggedInRef.current) {
      // Only clear session when transitioning from logged-in to logged-out (explicit logout)
      wasLoggedInRef.current = false;
      updateSupabaseSession(null);
    }
  }, [user.access_token, user.refresh_token, user.id, user.email, user.role]);

  // Keep saved session in sync with user state (for onboarding progress, profile changes, etc.)
  // Only updates if user previously opted in to quick login (session already exists in localStorage)
  useEffect(() => {
    if (user.isLoggedIn && user.id && biometricService.getSavedUser()) {
      biometricService.saveSession(user);
    }
  }, [user]);

  useEffect(() => {
    if (view === 'splash') {
      const timer = setTimeout(async () => {
        // Try to restore saved user from localStorage (instant, no network calls)
        const savedUser = biometricService.getSavedUser();

        if (savedUser) {
          console.log('[App] Restored saved user:', savedUser.id);
          setHasBiometricSession(true);
          setUser(savedUser);

          // Establish Supabase session BEFORE any authenticated queries.
          // The saved tokens may be expired but updateSupabaseSession will
          // refresh them using the refresh_token — this ensures Edge Function
          // calls and RLS-protected queries work correctly.
          if (savedUser.access_token && savedUser.refresh_token) {
            const sessionValid = await updateSupabaseSession({
              access_token: savedUser.access_token,
              refresh_token: savedUser.refresh_token,
              user: { id: savedUser.id, email: savedUser.email, user_metadata: { role: savedUser.role } } as any,
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: Date.now() + 3600 * 1000,
            });
            if (!sessionValid) {
              console.warn('[App] Session refresh failed — attempting silent re-auth');
              // Try silent re-auth using saved phone (same as consumer app pattern)
              const phone = savedUser.phone;
              const cc = savedUser.country_code || '+91';
              if (phone) {
                try {
                  const { user: freshProfile, session } = await userService.merchantOtpLogin(phone, cc);
                  if (freshProfile && session) {
                    console.log('[App] Silent re-auth succeeded for:', freshProfile.id);
                    const updatedUser = {
                      ...savedUser,
                      ...freshProfile,
                      isLoggedIn: true,
                      access_token: session.access_token,
                      refresh_token: session.refresh_token,
                    };
                    setUser(updatedUser);
                    await biometricService.saveSession(updatedUser);
                    // Re-establish Supabase session with fresh tokens
                    await updateSupabaseSession({
                      access_token: session.access_token,
                      refresh_token: session.refresh_token,
                      user: { id: freshProfile.id, email: freshProfile.email, user_metadata: { role: freshProfile.role } } as any,
                      token_type: 'bearer',
                      expires_in: 3600,
                      expires_at: Date.now() + 3600 * 1000,
                    });
                    // Continue to dashboard check below (don't return)
                  } else {
                    throw new Error('No session returned');
                  }
                } catch (reAuthErr) {
                  console.warn('[App] Silent re-auth failed — redirecting to login:', reAuthErr);
                  await biometricService.clearSession();
                  setUser({ id: '', username: '', isLoggedIn: false, role: 'consumer', full_name: '', access_token: null, refresh_token: null, onboarding_complete: false, hasActiveSubscription: false } as User);
                  setView('login');
                  return;
                }
              } else {
                console.warn('[App] No phone for re-auth — redirecting to login');
                await biometricService.clearSession();
                setUser({ id: '', username: '', isLoggedIn: false, role: 'consumer', full_name: '', access_token: null, refresh_token: null, onboarding_complete: false, hasActiveSubscription: false } as User);
                setView('login');
                return;
              }
            } else {
              console.log('[App] Supabase session established for splash restore');
            }
          }

          const userRole = savedUser.role || 'merchant';
          if (userRole === 'merchant') {
            // Try to check subscription fresh, but if the saved user already has
            // hasActiveSubscription set (e.g., just set by AuthStack login), trust it
            // to avoid 401 errors when the Supabase session isn't ready yet.
            let subscriptionInfo: { hasActiveSubscription: boolean; subscription_status?: string; current_tier_id?: number; trialExpired?: boolean; storeCount?: number } = { hasActiveSubscription: false };

            if (savedUser.hasActiveSubscription) {
              // Trust the saved subscription status (set during login)
              console.log('[App] Using saved subscription status: hasActiveSubscription =', savedUser.hasActiveSubscription);
              subscriptionInfo = {
                hasActiveSubscription: true,
                subscription_status: savedUser.subscription_status,
                current_tier_id: savedUser.current_tier_id,
                trialExpired: savedUser.trialExpired || false,
                storeCount: savedUser.storeCount,
              };
            } else {
              try {
                const { data: currentSession } = await supabase.auth.getSession();
                const token = currentSession?.session?.access_token || savedUser.access_token;
                subscriptionInfo = await merchantSubscriptionService.checkActiveSubscription(savedUser.id, token);
              } catch { /* assume no subscription */ }
            }

            const userWithSub = {
              ...savedUser,
              hasActiveSubscription: subscriptionInfo.hasActiveSubscription,
              subscription_status: subscriptionInfo.subscription_status,
              current_tier_id: subscriptionInfo.current_tier_id,
              trialExpired: subscriptionInfo.trialExpired || false,
            };
            setUser(userWithSub);
            await biometricService.saveSession(userWithSub);

            // Check if this is a staff member — they skip onboarding entirely
            const isStaffMember = savedUser.staff_role && savedUser.staff_role !== 'owner';

            // Existing merchant = has store_name + full_name from original signup
            // Don't force onboarding for missing optional fields (terms, privacy, category, etc.)
            const profileComplete = !!(savedUser.full_name && savedUser.store_name);

            if (isStaffMember) {
              // Staff members always go to dashboard — no onboarding
              console.log('[App] Staff member session restored — skipping onboarding → dashboard');
              userWithSub.hasActiveSubscription = true;
              navigateTo('merchant_dashboard');
            } else if (profileComplete) {
              if (!subscriptionInfo.hasActiveSubscription) {
                console.log('[App] Subscription check failed but profile complete — trusting saved session → dashboard');
                userWithSub.hasActiveSubscription = savedUser.hasActiveSubscription ?? true;
              }
              navigateTo('merchant_dashboard');
            } else {
              if (!subscriptionInfo.hasActiveSubscription) {
                console.log('[App] No subscription and profile incomplete — onboarding');
              } else {
                console.log('[App] Has subscription but profile incomplete — onboarding');
              }
              localStorage.removeItem(`merchant_onboarding_draft_${savedUser.id}`);
              navigateTo('merchant_onboarding');
            }
          } else {
            navigateTo('login');
          }
        } else {
          // No saved session — first time or logged out
          const hasCompletedLangSelection = localStorage.getItem('hasCompletedLanguageSelection') === 'true';
          setView(hasCompletedLangSelection ? 'login' : 'welcome');
        }
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [view]);

  // Show role selector when navigating to register, but NOT when returning from terms/privacy pages
  useEffect(() => {
    const fromSignupSubflow = prevViewRef.current === 'terms_of_service_signup' || prevViewRef.current === 'privacy_policy_signup';
    if (view === 'register' && !fromSignupSubflow) {
      setShowRoleSelector(true);
    }
    if (view === 'register' && fromSignupSubflow) {
      setTimeout(() => {
        if (mainRef.current) {
          mainRef.current.scrollTo({ top: mainRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 100);
    }
  }, [view]);

  // Biometric auto-login is now handled directly in the splash screen effect above.
  // When a saved session exists, the splash screen restores the user and navigates
  // directly to the correct view (merchant_onboarding or merchant_dashboard),
  // skipping the login screen entirely.


  const isLoginScreen = !user.isLoggedIn && (view === 'login' || view === 'forgot_password' || view === 'register');

  const handleBackNavigation = () => {
    if (view === 'language_selection') {
      navigateTo('welcome');
    } else if (view === 'location_permission') {
      navigateTo('language_selection');
    } else if (view === 'invite_code') {
      navigateTo('location_permission');
    } else if (!user.isLoggedIn && (view === 'register' || view === 'forgot_password' || view === 'verify_phone')) {
      navigateTo('login');
    } else if (view === 'merchant_deals') {
      navigateTo('merchant_dashboard');
    } else {
      navigateTo(lastListView);
    }
  };


  return (
    <div className={`max-w-md mx-auto h-screen overflow-hidden relative flex flex-col transition-colors duration-500 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    } ${theme === 'light' ? 'light-mode' : ''}`}> {/* Apply light-mode class to the root div */}
      {view === 'splash' ? (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6">
          <div className="relative mb-8 w-48 h-48">
            <img src="/assets/merchantlogo.svg" alt="DealPro Merchant Logo" className="w-full h-full object-contain animate-float" />
          </div>
          <h1 className="text-4xl font-semibold text-white text-center">
            Deal<span className="text-yellow-500">Pro</span>
          </h1>
          <p className="mt-4 text-xs text-slate-400 text-center font-medium">Engineered by Vedic Jaalam</p>
          <img src="/assets/vedicjaalam.svg?v=2" alt="Vedic Jaalam" className="mt-2 h-6 w-auto" />
        </div>
      ) : view === 'welcome' ? (
        <div className="h-screen bg-white flex flex-col px-8 pt-16 pb-10">
          {/* Logo + DealPro branding */}
          <div className="flex items-center gap-3 mb-6 animate-float-in float-in-delay-1">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0">
              <img src="/assets/merchantlogo.svg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-xl leading-none text-slate-900">Deal<span className="text-yellow-500">Pro</span></span>
          </div>

          {/* Headline */}
          <div className="animate-float-in float-in-delay-2">
            <h2 className="text-[2rem] leading-tight font-semibold text-slate-900 mb-2">
              Grow <span className="italic text-blue-700">your</span> business
            </h2>
            <h2 className="text-[2rem] leading-tight font-semibold text-slate-900 mb-10">
              with smart deals
            </h2>
          </div>

          {/* Benefits */}
          <p className="text-sm font-semibold text-slate-800 mb-6 animate-float-in float-in-delay-3">
            Everything you need to succeed:
          </p>

          <div className="space-y-6 flex-1">
            <div className="flex items-start gap-4 animate-float-in float-in-delay-4">
              <TrendingUp className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-base font-semibold text-slate-900">Reach</p>
                <p className="text-sm text-slate-500">Get discovered by local customers.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 animate-float-in float-in-delay-5">
              <BarChart3 className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-base font-semibold text-slate-900">Insights</p>
                <p className="text-sm text-slate-500">Track campaign performance in real-time.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 animate-float-in float-in-delay-6">
              <Zap className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-base font-semibold text-slate-900">Easy</p>
                <p className="text-sm text-slate-500">Create and manage deals in seconds.</p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 mt-8 animate-float-in float-in-delay-7">
            <button
              onClick={() => { setPendingAuthView('login'); navigateTo('language_selection'); }}
              className="flex-1 h-12 rounded-xl border-2 border-slate-900 text-slate-900 text-sm font-semibold tracking-wide active:scale-[0.98] transition-all"
            >
              SIGN IN
            </button>
            <button
              onClick={() => { setPendingAuthView('login'); navigateTo('language_selection'); }}
              className="flex-1 h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold tracking-wide active:scale-[0.98] transition-all"
            >
              JOIN
            </button>
          </div>
        </div>
      ) : (
        <>
          {view === 'language_selection' && <LanguageSelection setView={navigateTo} nextView={'location_permission'} />}
          {view === 'location_permission' && (
            <LocationPermission
              setView={navigateTo}
              nextView={'invite_code'}
              onLocationDetected={(city, state) => {
                setDetectedHomeLocation(city);
                setDetectedLocationState(state || null);
                setAllowLocation(true);
                console.log('[App] Location detected:', city, state);
              }}
            />
          )}
          {view === 'invite_code' && (
            <InviteCodeScreen
              setView={navigateTo}
              nextView={pendingAuthView}
              onInviteCodeValidated={(code) => {
                setInviteCode(code);
                console.log('[App] Invite code validated:', code);
              }}
            />
          )}
          <Header
            currentView={view}
            setView={navigateTo}
            showBack={['detail', 'register', 'forgot_password', 'merchant_deals', 'edit_profile', 'merchant_stores', 'help_feedback', 'my_redemptions', 'verify_phone', 'onboarding', 'merchant_subscriptions', 'payment_plans', 'bank_verification', 'store_search', 'notifications'].includes(view)}
            onBack={handleBackNavigation}
            theme={theme}
            toggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            isLoggedIn={user.isLoggedIn}
            userRole={user.role}
            unreadNotifications={unreadNotifications}
            onBellClick={user.isLoggedIn ? () => navigateTo('notifications') : undefined}
          />
          <main ref={mainRef} className="flex-1 overflow-y-auto hide-scrollbar pb-32">
            {!user.isLoggedIn ? (
              view === 'privacy_policy' ?
                <PrivacyPolicy setView={navigateTo} theme={theme} /> :
              view === 'terms_of_service' ?
                <TermsOfService setView={navigateTo} theme={theme} /> :
              (view === 'register' || view === 'terms_of_service_signup' || view === 'privacy_policy_signup') ? (
                <>
                  <MemberJoin
                    setView={navigateTo}
                    loading={loading}
                    setLoading={setLoading}
                    setShowOtpModal={setShowOtpModal}
                    setOtpPhoneNumber={setOtpPhoneNumber}
                    otpPhoneNumber={otpPhoneNumber}
                    isPhoneVerifiedForRegistration={isPhoneVerifiedForRegistration}
                    setRegistrationSuccessMessage={setRegistrationSuccessMessage}
                    theme={theme}
                    termsAccepted={termsAccepted}
                    setTermsAccepted={setTermsAccepted}
                    privacyAccepted={privacyAccepted}
                    setPrivacyAccepted={setPrivacyAccepted}
                    signupRole={signupRole}
                    setSignupRole={setSignupRole}
                    showRoleSelector={showRoleSelector}
                    setShowRoleSelector={setShowRoleSelector}
                  />
                  {view === 'terms_of_service_signup' && (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-gray-900">
                      <TermsOfServiceSignup setView={navigateTo} theme={theme} setTermsAccepted={setTermsAccepted} />
                    </div>
                  )}
                  {view === 'privacy_policy_signup' && (
                    <div className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-gray-900">
                      <PrivacyPolicySignup setView={navigateTo} theme={theme} setPrivacyAccepted={setPrivacyAccepted} />
                    </div>
                  )}
                </>
              ) :
              // The OtpVerificationModal no longer relies on a specific `setView` directly
              <AuthStack
                view={view}
                setView={navigateTo}
                setUser={setUser}
                loading={loading}
                setLoading={setLoading}
                registrationMessage={registrationSuccessMessage} // Pass message
                setRegistrationMessage={setRegistrationSuccessMessage} // Pass setter
                theme={theme} // Pass theme to AuthStack
                detectedHomeLocation={detectedHomeLocation}
                detectedLocationState={detectedLocationState}
                allowLocation={allowLocation}
                inviteCode={inviteCode}
              />
            ) : user.role === 'merchant' && view === 'merchant_onboarding' ? (
              <MerchantOnboarding
                setView={navigateTo}
                user={user}
                setUser={setUser}
                theme={theme}
              />
            ) : user.role === 'merchant' ? ( // Check for 'merchant' role
              <PermissionsProvider userId={user.id}>
              <MerchantStack
                view={view}
                setView={navigateTo}
                user={user}
                setUser={setUser}
                deals={deals}
                loading={loading}
                setLoading={setLoading}
                theme={theme}
                refreshDeals={refreshDeals}
                dealIdToEdit={dealIdToEdit}
                setDealIdToEdit={setDealIdToEdit}
                onClearDealIdToEdit={() => setDealIdToEdit(null)}
                isScanning={isScanning}
                setIsScanning={setIsScanning}
                preSelectedTab={preSelectedTab}
                setPreSelectedTab={setPreSelectedTab}
              />
              </PermissionsProvider>
            ) : null}
          </main>
          {user.isLoggedIn && user.role === 'merchant' && !['verify_phone', 'merchant_onboarding'].includes(view) && (
            <MerchantBottomNav currentView={view} setView={navigateTo} theme={theme} />
          )}

          <QRscan
            isOpen={isScanning}
            onClose={() => setIsScanning(false)}
            user={user}
            theme={theme}
          />

          {/* OTP Modal is rendered globally */}
          <OtpVerificationModal
            isOpen={showOtpModal}
            onClose={() => {
              setShowOtpModal(false);
              // When the modal closes, reset the phone number and verification status
              setOtpPhoneNumber('');
              setIsPhoneVerifiedForRegistration(false);
              // If we were trying to register, and the OTP verification failed or was cancelled,
              // we should keep the user on the registration page to retry.
              // If verification succeeded, onVerificationSuccess will handle navigation.
            }}
            phoneNumber={otpPhoneNumber}
            onVerificationSuccess={() => {
              setIsPhoneVerifiedForRegistration(true);
              setShowOtpModal(false);
              // After successful verification, let memberJoin proceed with registration
              // No direct navigation here, MemberJoin will handle the next step.
            }}
            onVerificationError={() => {
              // On error, the modal will handle displaying the error.
              // We reset the verification status so MemberJoin doesn't proceed.
              setIsPhoneVerifiedForRegistration(false);
            }}
          />
        </>
      )}
      <style>{`@keyframes loading { from { width: 0%; } to { width: 100%; } }`}</style>
    </div>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <AppContent />
  </LanguageProvider>
);

export default App;