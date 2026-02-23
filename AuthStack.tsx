
import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { userService } from './services/userService';
import { biometricService } from './services/biometricService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { fcmService } from './services/fcmService';
import { ForgotPwd } from './forgotpwd';
import { useTranslation } from './contexts/LanguageContext';
import {
  User as UserIcon,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  ShieldAlert,
  X,
  Fingerprint // Import Fingerprint icon
} from 'lucide-react';
import { supabase, updateSupabaseSession } from './services/supabaseClient';

interface AuthStackProps {
  view: AppView;
  setView: (view: AppView) => void;
  setUser: (user: any) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  registrationMessage: string | null;
  setRegistrationMessage: (msg: string | null) => void;
  theme: 'light' | 'dark'; // Add theme prop
}

export const AuthStack: React.FC<AuthStackProps> = ({ view, setView, setUser, loading, setLoading, registrationMessage, setRegistrationMessage, theme }) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [enableBiometrics, setEnableBiometrics] = useState(false);
  const { t, setLocale } = useTranslation();
  const isDark = theme === 'dark';

  const inputClass = `w-full h-12 px-4 rounded-lg text-sm font-medium border outline-none transition-all ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-slate-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
  }`;

  const handlePostLoginNavigation = async (userProfile: any, session: any) => {
    const userRole = userProfile.role || 'consumer';

    // Set language preference from user profile
    if (userProfile.lang_preference) {
      console.log('[AuthStack] Setting language preference from user profile:', userProfile.lang_preference);
      setLocale(userProfile.lang_preference);
    }

    // Initialize push notifications for all users
    try {
      await fcmService.initialize(userProfile.id);
      console.log('[AuthStack] Push notifications initialized for user:', userProfile.id);
    } catch (error) {
      console.error('[AuthStack] Failed to initialize push notifications:', error);
      // Don't block login if FCM fails
    }

    // Check subscription status for merchants
    let subscriptionInfo: { hasActiveSubscription: boolean; subscription_status?: string; current_tier_id?: number } = {
      hasActiveSubscription: false
    };
    if (userRole === 'merchant') {
      subscriptionInfo = await merchantSubscriptionService.checkActiveSubscription(userProfile.id);
      console.log('[AuthStack] Merchant subscription check:', subscriptionInfo);
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
    setUser(updatedUser);

    if (userRole === 'merchant') {
      // Route to subscriptions if no active subscription
      setView(subscriptionInfo.hasActiveSubscription ? 'merchant_dashboard' : 'merchant_subscriptions');
    } else if (userRole === 'dealadmin') {
      setView('dealadmin_review_deals');
    } else { // 'consumer' role
      // ALWAYS show onboarding/hoardings on login (not just first time)
      setView('onboarding');
    }
  };

  useEffect(() => {
    if (view === 'login') {
      if (registrationMessage) {
        setSuccessMessage(registrationMessage);
        setRegistrationMessage(null);
      }

      // Check session silently in background without showing loader
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
          const authUser = session.user;
          // Fetch the full user profile to get role and onboarding status
          const userProfile = await userService.getUserProfile(authUser.id);

          if (userProfile) {
            await updateSupabaseSession(session);
            handlePostLoginNavigation(userProfile, session);
          } else {
            // Handle case where profile is not found (e.g., corrupted DB entry)
            console.error("User profile not found after session restore. Forcing logout.");
            await biometricService.clearSession();
            setAuthError("Profile not found. Please log in again.");
          }
        }
      }).catch(err => {
        console.error("Error restoring session:", err);
        setAuthError("Failed to restore session. Please log in.");
      });
    }
  }, [view, setUser, setView, setLoading, registrationMessage, setRegistrationMessage]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const identifier = formData.get('identifier') as string;
    const password = formData.get('password') as string;

    try {
      const { user: authProfile, session } = await userService.loginUser(identifier, password);

      if (session && authProfile) {
        if (enableBiometrics) {
          await biometricService.saveSession(identifier, password);
        }
        handlePostLoginNavigation(authProfile, session);
      }
    } catch (err: any) {
      // Check if it's an authentication error (invalid credentials)
      const isAuthError = err.message?.toLowerCase().includes('invalid') ||
                         err.message?.toLowerCase().includes('credentials') ||
                         err.message?.toLowerCase().includes('password') ||
                         err.message?.toLowerCase().includes('email') ||
                         err.message?.toLowerCase().includes('user');

      setAuthError(isAuthError ? "Invalid username or password" : (err.message || "Connection failed."));
    } finally {
      setLoading(false);
    }
  };

  if (view === 'forgot_password') return <ForgotPwd setView={setView} loading={loading} setLoading={setLoading} theme={theme} />;

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
        {/* Sign-in Error Modal */}
        {authError && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-8">
            <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                </div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Signin Error</h3>
              </div>
              <p className={`text-sm mb-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Email or Password is incorrect. Please try again.
              </p>
              <button
                onClick={() => { setAuthError(null); setView('forgot_password'); }}
                className={`text-sm font-medium mb-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
              >
                Forgot Password?
              </button>
              <button
                onClick={() => setAuthError(null)}
                className="w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all"
              >
                OK
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 flex-1">
          <div className="relative">
            <input name="identifier" placeholder="Phone Number / Username" className={inputClass} required />
          </div>
          <div className="relative">
            <input name="password" type={showPassword ? "text" : "password"} placeholder={t('login_placeholder_pass')} className={`${inputClass} pr-12`} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`relative w-11 h-6 rounded-full transition-all duration-300
                ${enableBiometrics
                  ? 'bg-blue-600'
                  : isDark ? 'bg-slate-700' : 'bg-slate-300'
                }`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center transition-all duration-300 shadow-sm
                ${enableBiometrics ? 'left-[22px]' : 'left-0.5'}`}>
                <Fingerprint className={`w-3 h-3 transition-colors duration-300
                    ${enableBiometrics ? 'text-blue-600' : isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              </div>
            </div>
            <input type="checkbox" className="hidden" checked={enableBiometrics} onChange={(e) => setEnableBiometrics(e.target.checked)} />
            <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Biometric Auth</span>
          </label>

          <button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-slate-900 text-white font-medium text-sm flex items-center justify-center active:scale-[0.98] transition-all disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : t('login_btn')}
          </button>
        </form>

        {/* Terms of Service and Privacy Policy Notice */}
        <div className="mt-6 text-center px-4">
          <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            By continuing, you agree to our{' '}
            <button
              onClick={() => setView('terms_of_service')}
              className={`underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
            >
              Terms of Service
            </button>{' '}
            and acknowledge that you have read our{' '}
            <button
              onClick={() => setView('privacy_policy')}
              className={`underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} transition-colors`}
            >
              Privacy Policy
            </button>{' '}
            to learn how we collect, use and share your data.
          </p>
        </div>

        <div className="mt-8 text-center space-y-4 pb-20">
          <button onClick={() => setView('forgot_password')} className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('login_forgot') || 'Forgot Password?'}</button>
          <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            {t('login_register_hint') || 'New to DealPro?'} <button onClick={() => setView('register')} className={`ml-1 font-semibold ${isDark ? 'text-white' : 'text-green-600'}`}>{t('login_register_action') || 'Signup'}</button>
          </p>
        </div>
      </div>
    );
  }

  return null;
};
