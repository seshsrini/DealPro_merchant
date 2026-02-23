
import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  Store,
  LogOut,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldAlert,
  ArrowLeft
} from 'lucide-react';
import { biometricService } from './services/biometricService';
import { fcmService } from './services/fcmService';
import { AppView } from './types';
import { addCampaignService } from './services/addCampaignService';
import { editProfileService } from './services/editProfileService';

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

  // Profile States
  const [fullName, setFullName] = useState(user.full_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [storeName, setStoreName] = useState(user.store_name || '');
  const [category, setCategory] = useState(user.category || '');
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [isCatsLoading, setIsCatsLoading] = useState(false);

  // Password Reset States
  const [showPwd, setShowPwd] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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
        phone: phone,
      };

      if (isMerchant) {
        updateData.store_name = storeName;
        updateData.category = category;
      }

      if (newPassword) {
        if (newPassword.length < 8) {
          throw new Error("Password must be at least 8 characters with one uppercase letter and one number.");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("Passwords do not match. Please try again.");
        }
        updateData.password = newPassword;
      }

      await editProfileService.updateUserProfile(user.id, user.role, updateData);

      const updatedUser = { ...user, ...updateData };
      if (newPassword) {
        setUser({ ...updatedUser, isLoggedIn: false, access_token: null, refresh_token: null });
        setView('login');
        alert("Password updated successfully. Please log in again.");
        await biometricService.clearSession();
        return;
      }

      setUser(updatedUser);
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');

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
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Update your store details</p>
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
          <div className="flex items-center gap-2 px-1">
            <UserIcon className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Personal Information</span>
          </div>

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
              required
            />
          </div>

          <div className="relative">
            <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Phone Number"
              className={`${inputClass} pl-11`}
              required
            />
          </div>
        </div>

        {/* Store Information */}
        {isMerchant && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Store className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Store Information</span>
            </div>

            <input
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="Store Name"
              className={inputClass}
              required
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

        {/* Change Password */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Lock className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Change Password</span>
          </div>

          <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="New Password"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <input
              type={showPwd ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Password"
              className={inputClass}
            />

            <p className={`text-[10px] text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Leave blank to keep your current password
            </p>
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
