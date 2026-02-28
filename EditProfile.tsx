
import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { biometricService } from './services/biometricService';
import { fcmService } from './services/fcmService';
import { AppView } from './types';
import { addCampaignService } from './services/addCampaignService';
import { editProfileService } from './services/editProfileService';

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
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Personal
  const [fullName, setFullName] = useState(user.full_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone] = useState(user.phone || '');
  const [countryCode] = useState(user.country_code || '');

  // Store
  const [storeName, setStoreName] = useState(user.store_name || '');
  const [category, setCategory] = useState(user.category || '');
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [isCatsLoading, setIsCatsLoading] = useState(false);

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

  const isMerchant = user.role?.startsWith('merchant');

  useEffect(() => {
    if (isMerchant) {
      setIsCatsLoading(true);
      addCampaignService.getStoreCategories().then(cats => {
        setDbCategories(cats);
        setIsCatsLoading(false);
      });
    }
  }, [isMerchant]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const updateData: any = {
        full_name: fullName,
        email: email,
      };

      if (isMerchant) {
        updateData.category = category;
      }

      // Preferences
      updateData.lang_preference = langPreference;
      updateData.push_notification = pushNotification;
      updateData.email_notification = emailNotification;
      updateData.text_notification = textNotification;

      await editProfileService.updateUserProfile(user.id, user.role, updateData);

      setUser({ ...user, ...updateData });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out?")) {
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
      <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
    </div>
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
    <div className={`px-6 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
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
              Edit Profile
            </h2>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Manage your account details</p>
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
          <span className="text-xs font-medium text-emerald-500">Profile updated successfully</span>
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
            <UserIcon className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />,
            'Personal Information'
          )}

          <input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Full Name"
            className={inputClass}
            required
          />

          <div className="relative">
            <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email Address"
              className={`${inputClass} pl-11`}
            />
          </div>

          <div className="relative">
            <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              value={`${countryCode ? countryCode + ' ' : ''}${phone}`}
              className={`${readOnlyClass} pl-11`}
              readOnly
            />
          </div>
        </div>

        {/* Store Information */}
        {isMerchant && (
          <div className="space-y-3">
            {sectionHeader(
              <Store className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />,
              'Store Information'
            )}

            <input
              value={storeName}
              className={readOnlyClass}
              readOnly
            />

            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className={inputClass}
                required
                disabled={isCatsLoading}
              >
                <option value="">{isCatsLoading ? 'Loading categories...' : 'Select Category'}</option>
                {dbCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {isCatsLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
            </div>
          </div>
        )}

        {/* Business Verification (Read-only) */}
        {isMerchant && businessType && (
          <div className="space-y-3">
            {sectionHeader(
              <Briefcase className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />,
              'Business Verification'
            )}

            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Business Type</span>
                <span className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{businessType}</span>
              </div>

              {gstin && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>GSTIN</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(gstin)}</span>
                </div>
              )}

              {pan && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>PAN</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(pan)}</span>
                </div>
              )}

              {udyamNo && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Udyam No</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(udyamNo)}</span>
                </div>
              )}

              {fssaiNo && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>FSSAI No</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(fssaiNo)}</span>
                </div>
              )}

              {tradeLicenseNo && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Trade License</span>
                  <span className={`text-sm font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{maskField(tradeLicenseNo)}</span>
                </div>
              )}

              <p className={`text-[10px] text-center pt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Contact support to update business verification details
              </p>
            </div>
          </div>
        )}

        {/* Preferences */}
        <div className="space-y-3">
          {sectionHeader(
            <Globe className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />,
            'Language'
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

        {/* Notification Preferences */}
        <div className="space-y-3">
          {sectionHeader(
            <Bell className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />,
            'Notifications'
          )}

          <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            {toggleSwitch(pushNotification, setPushNotification, 'Push Notifications')}
            {toggleSwitch(emailNotification, setEmailNotification, 'Email Notifications')}
            {toggleSwitch(textNotification, setTextNotification, 'SMS Notifications')}
          </div>
        </div>

        {/* Account Info (Read-only) */}
        <div className="space-y-3">
          {sectionHeader(
            <ShieldAlert className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />,
            'Account'
          )}
          <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Role</span>
              <span className={`text-sm font-medium capitalize ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{user.role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Referral Code</span>
              <span className={`text-sm font-mono font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{user.my_referral_code || '—'}</span>
            </div>
            {user.terms_accepted && (
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Terms Accepted</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            )}
            {user.privacy_accepted && (
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Privacy Accepted</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
            )}
            {user.created_at && (
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Member Since</span>
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
            'Save Changes'
          )}
        </button>
      </form>
    </div>
  );
};
