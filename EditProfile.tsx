
import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Mail, 
  Phone, 
  Lock, 
  ShieldCheck, 
  Store, 
  Activity, 
  LogOut, 
  Loader2, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { userService } from './services/userService';
import { biometricService } from './services/biometricService';
import { AppView } from './types';
// Removed decryptPassword import as it's no longer used
import { addCampaignService } from './services/addCampaignService';
import { editProfileService } from './services/editProfileService'; // New import
import { supabase } from './services/supabaseClient'; // Import supabase for logging headers

interface EditProfileProps {
  user: any;
  setUser: (user: any) => void;
  setView: (view: AppView) => void;
}

export const EditProfile: React.FC<EditProfileProps> = ({ user, setUser, setView }) => {
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
  // Old password is not needed for Supabase.auth.updateUser, only newPassword and confirmPassword.
  // The backend will verify identity based on the JWT.
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isMerchant = user.role?.startsWith('merchant');

  // Load categories from DB for merchants
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

      // Password Logic: only update if new password is provided
      if (newPassword) {
        if (newPassword.length < 8) {
          throw new Error("New credential must be 8-15 characters, contain one uppercase letter, one number, and no spaces.");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("Credential confirmation failed. Passwords do not match.");
        }
        updateData.password = newPassword; // Plain text password sent to Edge Function for Supabase Auth
      }

      console.log(`[EditProfile] Attempting to update profile for user ID: ${user.id}`);
      console.log(`[EditProfile] User Role: ${user.role}`);
      console.log(`[EditProfile] Payload sent to updateUserProfile service:`, updateData);
      console.log(`[EditProfile] Supabase client Authorization header before updateProfile: ${supabase.headers['Authorization'] ? supabase.headers['Authorization'].substring(0, 30) + '...' : 'Not set'}`);

      await editProfileService.updateUserProfile(user.id, user.role, updateData); // Use new service
      
      // Update local user state with new data, excluding the password itself
      const updatedUser = { ...user, ...updateData };
      if (newPassword) {
        // If password was changed, clear existing access token, forcing re-login.
        // Supabase often invalidates sessions on password change for security.
        setUser({ ...updatedUser, isLoggedIn: false, access_token: null, refresh_token: null });
        setView('login');
        alert("Password updated successfully. Please log in again with your new password.");
        await biometricService.clearSession(); // Clear biometric session if password changed
        return;
      }

      setUser(updatedUser);
      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Uplink failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm("Terminate secure session and exit grid?")) {
      await biometricService.clearSession(); // Clears local storage and signs out from Supabase Auth
      setUser({ id: '', username: '', isLoggedIn: false, role: 'user', access_token: null, refresh_token: null });
      setView('login');
    }
  };

  return (
    <div className="px-8 pt-6 pb-32 animate-reveal space-y-10">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter leading-none text-white">
            Identity<br/><span className="text-blue-500">Protocol</span>
          </h2>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">Manage Grid Credentials</p>
        </div>
        <button 
          onClick={handleLogout}
          className="w-14 h-14 glass rounded-2xl flex items-center justify-center border-rose-500/20 text-rose-500 active:scale-90 transition-transform"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>

      {success && (
        <div className="p-5 glass border-emerald-500/20 bg-emerald-500/5 rounded-3xl flex items-center gap-4 animate-reveal">
          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Identity successfully synchronized</p>
        </div>
      )}

      {error && (
        <div className="p-5 glass border-rose-500/20 bg-rose-500/5 rounded-3xl flex items-center gap-4 animate-shake">
          <ShieldAlert className="w-6 h-6 text-rose-500" />
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleUpdate} className="space-y-8">
        {/* Core Identity */}
        <div className="space-y-4">
          <div className="px-2 flex items-center gap-2">
            <UserIcon className="w-3 h-3 text-blue-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Core Identity</span>
          </div>
          <div className="space-y-4">
            <input 
              value={fullName} 
              onChange={e => setFullName(e.target.value)}
              placeholder="Full Name" 
              className="input-premium" 
              required 
            />
            <div className="relative group">
              <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="email"
                value={email} 
                onChange={e => setEmail(e.target.value)}
                placeholder="Email Address" 
                className="input-premium pl-14" 
                required 
              />
            </div>
            <div className="relative group">
              <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                value={phone} 
                onChange={e => setPhone(e.target.value)}
                placeholder="Phone Number" 
                className="input-premium pl-14" 
                required 
              />
            </div>
          </div>
        </div>

        {/* Merchant Parameters */}
        {isMerchant && (
          <div className="space-y-4 animate-reveal">
            <div className="px-2 flex items-center gap-2">
              <Store className="w-3 h-3 text-blue-500" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Node Parameters</span>
            </div>
            <div className="space-y-4">
              <input 
                value={storeName} 
                onChange={e => setStoreName(e.target.value)}
                placeholder="Store Name" 
                className="input-premium" 
                required 
              />
              <div className="relative group">
                <Activity className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  className="input-premium pl-14"
                  required
                  disabled={isCatsLoading}
                >
                  <option value="">{isCatsLoading ? 'Syncing Sectors...' : 'Select Sector'}</option>
                  {dbCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {isCatsLoading && <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-blue-500" />}
              </div>
            </div>
          </div>
        )}

        {/* Security Vault */}
        <div className="space-y-4">
          <div className="px-2 flex items-center gap-2">
            <Lock className="w-3 h-3 text-amber-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Security Vault</span>
          </div>
          <div className="glass p-6 rounded-[2rem] border-white/5 bg-slate-900/40 space-y-4">
            {/* Old password input removed as it's not needed for Supabase.auth.updateUser for logged in users */}
            <input 
              type={showPwd ? "text" : "password"}
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New Secure Pass" 
              className="input-premium border-transparent bg-white/5" 
            />
            <input 
              type={showPwd ? "text" : "password"}
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Pass" 
              className="input-premium border-transparent bg-white/5" 
            />
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-600 px-2 italic text-center">
              Leave blank to retain current security clearance
            </p>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full btn-premium h-20 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all rounded-[2rem]"
        >
          {loading ? <Loader2 className="w-8 h-8 animate-spin" /> : (
            <div className="flex items-center gap-4">
              <ShieldCheck className="w-8 h-8 text-white" />
              <span className="font-black text-xl tracking-widest uppercase">Update Protocol</span>
            </div>
          )}
        </button>
      </form>

      <div className="text-center opacity-30">
        <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-600">Instance ID: {user.id.toUpperCase()}</p>
      </div>
    </div>
  );
};
