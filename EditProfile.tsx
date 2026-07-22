
import React, { useState, useRef, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Store,
  LogOut,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  ArrowLeft,
  Briefcase,
  Bell,
  Globe,
  MapPin,
} from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { biometricService } from './services/biometricService';
import { fcmService } from './services/fcmService';
import { AppView } from './types';
import { editProfileService } from './services/editProfileService';
import { useTranslation } from './contexts/LanguageContext';

const BUSINESS_TYPES = ['GSTIN + PAN', 'Udyam', 'FSSAI', 'Trade License'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'bn', label: 'Bengali' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
];

interface EditProfileProps {
  user: any;
  setUser: (user: any) => void;
  setView: (view: AppView) => void;
  theme?: 'dark' | 'light';
}

export const EditProfile: React.FC<EditProfileProps> = ({ user, setUser, setView, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const topRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Personal. Full name is display-only — changed via support, like store name
  // and the verification fields — so it has no setter and isn't sent on save.
  const [fullName] = useState(user.full_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone] = useState(user.phone || '');
  const [countryCode] = useState(user.country_code || '');

  // Store
  const [storeName] = useState(user.store_name || '');

  // Business Verification (read-only display)
  const [businessType] = useState(user.business_type || '');
  const [gstin] = useState(user.gstin || '');
  const [pan] = useState(user.pan || '');
  const [udyamNo] = useState(user.udyam_no || '');
  const [fssaiNo] = useState(user.fssai_no || '');
  const [tradeLicenseNo] = useState(user.trade_license_no || '');

  // Preferences
  const [langPreference, setLangPreference] = useState(user.lang_preference || 'en');
  const [pushNotification, setPushNotification] = useState(user.push_notification ?? true);
  const [emailNotification, setEmailNotification] = useState(user.email_notification ?? false);
  const [textNotification, setTextNotification] = useState(user.text_notification ?? false);

  // Location permission (OS-level, not a DB field). Reflects the current grant so
  // the merchant can enable it here — important for nearby deals + mapping the store.
  const [locationEnabled, setLocationEnabled] = useState(false);
  useEffect(() => {
    Geolocation.checkPermissions()
      .then(p => setLocationEnabled(p.location === 'granted' || (p as any).coarseLocation === 'granted'))
      .catch(() => { /* web / unavailable */ });
  }, []);
  const handleLocationToggle = async (next: boolean) => {
    setError(null);
    if (next) {
      try {
        let perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted' && (perm as any).coarseLocation !== 'granted') {
          perm = await Geolocation.requestPermissions();
        }
        const granted = perm.location === 'granted' || (perm as any).coarseLocation === 'granted';
        setLocationEnabled(granted);
        if (!granted) setError(t('m_location_denied')); // OS denied — guide to Settings
      } catch {
        setLocationEnabled(false);
      }
    } else {
      // The app can't revoke an OS permission programmatically — send them to Settings.
      setError(t('m_location_disable_hint'));
    }
  };

  // Email-capture prompt when enabling email notifications without an email on file.
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailPromptError, setEmailPromptError] = useState<string | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);

  const isMerchant = user.role?.startsWith('merchant');

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());

  // Enabling email notifications: if no valid email is on file, prompt for it
  // first and store it; otherwise just enable.
  const handleEmailNotifToggle = (next: boolean) => {
    if (!next) { setEmailNotification(false); return; }
    if (isValidEmail(email)) {
      setEmailNotification(true);
    } else {
      setEmailDraft(email || '');
      setEmailPromptError(null);
      setShowEmailPrompt(true);
    }
  };

  // Save the captured email to merchant_profiles.email and enable the toggle.
  const confirmEmailForNotif = async () => {
    const e = emailDraft.trim();
    if (!isValidEmail(e)) { setEmailPromptError('Please enter a valid email address.'); return; }
    setSavingEmail(true);
    setEmailPromptError(null);
    try {
      await editProfileService.updateUserProfile(user.id, user.role, { email: e, email_notification: true });
      setEmail(e);
      setEmailNotification(true);
      setUser({ ...user, email: e, email_notification: true });
      setShowEmailPrompt(false);
    } catch {
      setEmailPromptError('Could not save your email. Please try again.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updateData: any = {
        email: email,
      };

      // Preferences
      updateData.lang_preference = langPreference;
      updateData.push_notification = pushNotification;
      updateData.email_notification = emailNotification;
      updateData.text_notification = textNotification;

      await editProfileService.updateUserProfile(user.id, user.role, updateData);

      setUser({ ...user, ...updateData });
      setSuccess(true);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(t('m_save_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm(t('m_sign_out_confirm'))) {
      try {
        await fcmService.unregisterToken();
        await fcmService.cleanup();
      } catch (error) {
        console.error('[EditProfile] Failed to cleanup push notifications:', error);
      }

      await biometricService.clearSession();
      setUser({ id: '', username: '', isLoggedIn: false, role: 'user', access_token: null, refresh_token: null });
      setView('login');
    }
  };

  const inputClass = `w-full h-12 px-4 rounded-lg text-sm font-normal outline-none transition-all ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
      : 'bg-slate-50 text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
  }`;

  const readOnlyClass = `w-full h-12 px-4 rounded-lg text-sm font-normal outline-none ${
    isDark
      ? 'bg-slate-800/50 text-slate-400 border border-slate-700/50'
      : 'bg-slate-100 text-slate-500 border border-slate-200'
  }`;

  const sectionHeader = (icon: React.ReactNode, label: string) => (
    <div className="flex items-center gap-2 px-1">
      {icon}
      <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{label}</span>
    </div>
  );

  // Per-field caption. The inputs previously carried only placeholders, which
  // disappear once a field has a value — so a merchant with a saved name/store
  // saw unlabelled boxes and reported the fields as "not showing up".
  const fieldLabel = (text: string) => (
    <label className={`block text-xs font-medium mb-1.5 px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
      {text}
    </label>
  );

  const toggleSwitch = (value: boolean, onChange: (v: boolean) => void, label: string) => (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-all ${value ? 'bg-emerald-500' : isDark ? 'bg-slate-600' : 'bg-slate-300'}`}
      >
        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  // Mask sensitive fields - show last 4 chars only
  const maskField = (val: string) => {
    if (!val || val.length <= 4) return val;
    return '*'.repeat(val.length - 4) + val.slice(-4);
  };

  return (
    <div ref={topRef} className={`px-6 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('profile')}
            className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all ${isDark ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('m_edit_profile')}
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_manage_account_details')}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-90 transition-all ${isDark ? 'bg-slate-800' : 'bg-red-50'}`}
        >
          <LogOut className="w-5 h-5 text-red-500" />
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-xs font-medium text-emerald-500">{t('m_profile_updated')}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs font-medium text-red-500">{error}</span>
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-6">
        {/* Personal Information */}
        <div className="space-y-3">
          {sectionHeader(
            <UserIcon className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />,
            t('m_personal_info')
          )}

          <div>
            {fieldLabel(t('m_full_name'))}
            <input
              value={fullName}
              placeholder={t('m_full_name')}
              className={readOnlyClass}
              readOnly
            />
          </div>

          <div>
            {fieldLabel(t('m_email_address'))}
            <div className="relative">
              <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('m_email_address')}
                className={`${inputClass} pl-11`}
              />
            </div>
          </div>

          <div>
            {fieldLabel(t('m_phone'))}
            <div className="relative">
              <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
              <input
                value={`${countryCode ? countryCode + ' ' : ''}${phone}`}
                className={`${readOnlyClass} pl-11`}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Store Information */}
        {isMerchant && (
          <div className="space-y-3">
            {sectionHeader(
              <Store className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />,
              t('m_store_info')
            )}

            <div>
              {fieldLabel(t('m_store_name'))}
              <input
                value={storeName}
                placeholder={t('m_store_name')}
                className={readOnlyClass}
                readOnly
              />
            </div>
          </div>
        )}

        {/* Business Verification (Read-only) */}
        {isMerchant && businessType && (
          <div className="space-y-3">
            {sectionHeader(
              <Briefcase className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />,
              t('m_business_verification')
            )}

            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_business_type')}</span>
                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{businessType}</span>
              </div>

              {gstin && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_gstin')}</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(gstin)}</span>
                </div>
              )}

              {pan && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_pan')}</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(pan)}</span>
                </div>
              )}

              {udyamNo && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_udyam')}</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(udyamNo)}</span>
                </div>
              )}

              {fssaiNo && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_fssai')}</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(fssaiNo)}</span>
                </div>
              )}

              {tradeLicenseNo && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_trade_license')}</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(tradeLicenseNo)}</span>
                </div>
              )}

              <p className={`text-[10px] text-center pt-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                {t('m_contact_support_biz')}
              </p>
            </div>
          </div>
        )}

        {/* Preferences */}
        <div className="space-y-3">
          {sectionHeader(
            <Globe className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />,
            t('m_language')
          )}
          <select
            value={langPreference}
            onChange={e => setLangPreference(e.target.value)}
            className={inputClass}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div className="space-y-3">
          {sectionHeader(
            <MapPin className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />,
            t('m_location')
          )}
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            {toggleSwitch(locationEnabled, handleLocationToggle, t('m_location_enable'))}
            <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{t('m_location_hint')}</p>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="space-y-3">
          {sectionHeader(
            <Bell className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />,
            t('m_notifications')
          )}

          <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            {toggleSwitch(pushNotification, setPushNotification, t('m_push_notif'))}
            {toggleSwitch(emailNotification, handleEmailNotifToggle, t('m_email_notif'))}
            {toggleSwitch(textNotification, setTextNotification, t('m_sms_notif'))}
          </div>
        </div>

        {/* Account Info (Read-only) */}
        <div className="space-y-3">
          {sectionHeader(
            <ShieldAlert className={`w-3.5 h-3.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />,
            t('m_account')
          )}
          <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_role')}</span>
              <span className={`text-sm font-medium capitalize ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{user.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_referral_code')}</span>
              <span className={`text-sm font-mono font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{user.my_referral_code || '—'}</span>
            </div>
            {user.terms_accepted && (
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_terms_accepted')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            )}
            {user.privacy_accepted && (
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_privacy_accepted')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            )}
            {user.created_at && (
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_member_since')}</span>
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            t('m_save_changes')
          )}
        </button>
      </form>

      {/* Email-capture prompt — shown only when enabling email notifications
          without a valid email already on file. Stores to merchant_profiles.email. */}
      {showEmailPrompt && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className={`w-full max-w-sm rounded-2xl p-6 space-y-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Add your email</h3>
                <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>We'll send your email notifications here.</p>
              </div>
            </div>
            <input
              type="email"
              autoFocus
              value={emailDraft}
              onChange={(e) => { setEmailDraft(e.target.value); setEmailPromptError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmEmailForNotif(); }}
              placeholder="you@example.com"
              className={inputClass}
            />
            {emailPromptError && <p className="text-xs text-red-500">{emailPromptError}</p>}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowEmailPrompt(false)}
                disabled={savingEmail}
                className={`flex-1 h-11 rounded-xl text-sm font-medium border active:scale-[0.98] transition-all ${isDark ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-900'}`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEmailForNotif}
                disabled={savingEmail || !isValidEmail(emailDraft)}
                className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
