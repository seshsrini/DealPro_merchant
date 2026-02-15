
import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { userService } from './services/userService';
import { biometricService } from './services/biometricService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
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

  const handlePostLoginNavigation = async (userProfile: any, session: any) => {
    const userRole = userProfile.role || 'consumer';

    // Set language preference from user profile
    if (userProfile.lang_preference) {
      console.log('[AuthStack] Setting language preference from user profile:', userProfile.lang_preference);
      setLocale(userProfile.lang_preference);
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

  if (view === 'forgot_password') return <ForgotPwd setView={setView} loading={loading} setLoading={setLoading} />;

  if (view === 'login') {
    return (
      <div className="px-8 pt-8 animate-reveal flex flex-col">
        <div className="w-full text-left mb-8">
          <h2 className={`text-5xl font-black tracking-tighter uppercase leading-none mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Smart<br/><span className="text-yellow-500">Discovery</span>
          </h2>
          <p className={`text-slate-400 font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{t('login_sub')}</p>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 glass border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-[10px] font-black uppercase rounded-2xl animate-reveal flex items-center gap-2 relative">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}
        {authError && (
          <div className="mb-6 p-4 glass border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-2xl animate-shake flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6 flex-1">
          <div className="relative group">
            <input name="identifier" placeholder={t('login_placeholder_id')} className="input-premium" required />
          </div>
          <div className="relative group">
            <input name="password" type={showPassword ? "text" : "password"} placeholder={t('login_placeholder_pass')} className="input-premium pr-14" required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <label className={`flex items-center gap-4 glass p-5 rounded-[1.5rem] border-white/5 cursor-pointer ${isDark ? '' : 'light-mode-glass'}`}>
            {/* Modern Toggle Switch Design */}
            <div className={`relative w-12 h-6 rounded-full transition-all duration-300 biometric-toggle-switch 
                ${enableBiometrics 
                  ? (isDark ? 'bg-blue-600' : 'bg-blue-600 active') 
                  : (isDark ? 'bg-slate-700/50' : 'bg-slate-300 inactive')
                }`}>
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white flex items-center justify-center transition-all duration-300 shadow-md toggle-circle 
                ${enableBiometrics ? 'translate-x-[calc(100%-2px)] active' : 'translate-x-[2px] inactive'}`}>
                <Fingerprint className={`w-3 h-3 transition-colors duration-300 
                    ${enableBiometrics 
                      ? (isDark ? 'text-blue-600' : 'text-blue-600') 
                      : (isDark ? 'text-slate-400' : 'text-slate-700')
                    }`} />
              </div>
            </div>
            <input type="checkbox" className="hidden" checked={enableBiometrics} onChange={(e) => setEnableBiometrics(e.target.checked)} />
            <span className={`text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Biometric Auth</span>
          </label>

          <button type="submit" disabled={loading} className="w-full btn-premium shadow-2xl shadow-yellow-500/20">
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : t('login_btn')}
          </button>
        </form>

        {/* Terms of Service and Privacy Policy Notice */}
        <div className="mt-6 text-center px-4">
          <p className={`text-[9px] leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>
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
          <button onClick={() => setView('forgot_password')} className={`text-[10px] font-black uppercase tracking-[0.3em] ${isDark ? 'text-slate-500' : 'text-slate-800'}`}>{t('login_forgot') || 'Forgot Password?'}</button>
          <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${isDark ? 'text-slate-500' : 'text-slate-800'}`}>
            {t('login_register_hint') || 'New to the Grid?'} <button onClick={() => setView('register')} className={`ml-1 border-b ${isDark ? 'text-white border-white/20' : 'text-yellow-600 border-yellow-600/30'}`}>{t('login_register_action') || 'Signup'}</button>
          </p>
        </div>
      </div>
    );
  }

  return null;
};