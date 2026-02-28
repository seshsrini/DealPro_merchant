
import React, { useState, useMemo } from 'react';
import {
  User as UserIcon,
  Store,
  ShieldCheck,
  ChevronRight,
  PenLine,
  HelpCircle,
  Share2,
  Loader2,
  CheckCircle2,
  CreditCard,
  Zap,
  PlayCircle,
  MapPin,
} from 'lucide-react';
import { AppView } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { userService } from './services/userService';
import { MreferralService } from './services/MreferralService';
import { resetFeatureTour } from './components/FeatureTour';
import { resetCampaignTour } from './components/CampaignTour';

interface MerchantProfileProps {
  user: any;
  setUser: (user: any) => void;
  setView: (view: AppView) => void;
  theme?: 'dark' | 'light';
}

export const MerchantProfile: React.FC<MerchantProfileProps> = ({ user, setUser, setView, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);

  const merchantReferralCode = useMemo(() => {
    return user.my_referral_code || `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }, [user.my_referral_code]);

  const handleInviteViaWhatsApp = async () => {
    setIsInviting(true);
    setShowInviteSuccess(false);

    try {
      const referralCode = merchantReferralCode;
      const storeName = user.store_name || user.username || 'DealPro Merchant';

      await userService.logActivity({
        user_id: user.id,
        event_type: 'click',
        platform: 'mobile',
        metadata: { action: 'refer_partner', referral_code_used: referralCode }
      });

      await MreferralService.onInviteSent(user.id, referralCode, null, null);

      const message = `Hi! This is ${storeName}. I am using DealPro to grow my business. Join using my code ${referralCode} and get started here: https://dealpro.app/signup?ref=${referralCode}`;
      const whatsappLink = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappLink, '_blank');

      await new Promise(resolve => setTimeout(resolve, 1500));

      setIsInviting(false);
      setShowInviteSuccess(true);

      setTimeout(() => setShowInviteSuccess(false), 4000);
    } catch (err: any) {
      console.error("Failed to send invite:", err);
      setIsInviting(false);
      setShowInviteSuccess(false);
    }
  };

  return (
    <div className={`px-6 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Profile Avatar */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative mb-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <Store className={`w-10 h-10 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          </div>
          <button
            onClick={() => setView('edit_profile')}
            className={`absolute bottom-0 right-0 w-7 h-7 rounded-full bg-slate-900 border-2 ${isDark ? 'border-slate-950' : 'border-white'} flex items-center justify-center active:scale-90 transition-all`}
          >
            <PenLine className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{user.store_name || user.username}</h2>
        <div className="flex items-center gap-1.5 mt-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('profile_verified_merchant')}</span>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-3">
        {/* Edit Store Profile */}
        <button onClick={() => setView('edit_profile')} className={`w-full p-4 rounded-xl flex items-center justify-between active:scale-[0.98] transition-all border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
              <PenLine className="w-5 h-5 text-indigo-500" />
            </div>
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_edit_store')}</span>
          </div>
          <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        </button>

        {/* My Stores */}
        <button onClick={() => setView('merchant_stores')} className={`w-full p-4 rounded-xl flex items-center justify-between active:scale-[0.98] transition-all border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
              <MapPin className="w-5 h-5 text-teal-500" />
            </div>
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>My Stores</span>
          </div>
          <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        </button>

        {/* My Subscriptions */}
        <button onClick={() => setView('merchant_subscriptions')} className={`w-full p-4 rounded-xl flex items-center justify-between active:scale-[0.98] transition-all border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
              <CreditCard className="w-5 h-5 text-purple-500" />
            </div>
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_subscriptions')}</span>
          </div>
          <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        </button>

        {/* Payment Plans */}
        <button onClick={() => setView('payment_plans')} className={`w-full p-4 rounded-xl flex items-center justify-between active:scale-[0.98] transition-all border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
              <CreditCard className="w-5 h-5 text-rose-500" />
            </div>
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_payments')}</span>
          </div>
          <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        </button>

        {/* Replay Feature Tour */}
        <button onClick={() => { resetFeatureTour(user.id); setView('merchant_dashboard'); }} className={`w-full p-4 rounded-xl flex items-center justify-between active:scale-[0.98] transition-all border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
              <PlayCircle className="w-5 h-5 text-cyan-500" />
            </div>
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Replay Feature Tour</span>
          </div>
          <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        </button>

        {/* Replay Campaign Tour */}
        <button onClick={() => { resetCampaignTour(user.id); setView('merchant_deals'); }} className={`w-full p-4 rounded-xl flex items-center justify-between active:scale-[0.98] transition-all border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}`}>
              <PlayCircle className="w-5 h-5 text-violet-500" />
            </div>
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Replay Campaign Tour</span>
          </div>
          <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        </button>

        {/* Help & Support */}
        <button onClick={() => setView('help_feedback')} className={`w-full p-4 rounded-xl flex items-center justify-between active:scale-[0.98] transition-all border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <HelpCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_support_hub')}</span>
          </div>
          <ChevronRight className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
        </button>

        {/* Invite a Partner */}
        <div className={`w-full p-4 rounded-xl space-y-3 border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
              <Share2 className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <span className={`block font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_invite_partner')}</span>
              <span className={`block text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Invite other merchants via WhatsApp</span>
            </div>
          </div>

          {/* Referral Code */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
            <Zap className="w-4 h-4 text-blue-500" />
            <p className={`text-xs font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              Your Code: <span className="font-mono font-semibold">{merchantReferralCode}</span>
            </p>
          </div>

          <button
            onClick={handleInviteViaWhatsApp}
            disabled={isInviting}
            className="w-full h-11 rounded-xl bg-emerald-600 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isInviting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Send via WhatsApp
              </>
            )}
          </button>

          {showInviteSuccess && (
            <div className="flex items-center gap-2 px-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <p className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                {t('profile_invite_success')}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10 text-center">
        <p className={`text-[10px] font-medium ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>&copy; 2026 DealPro Merchant. All Rights Reserved.</p>
      </div>
    </div>
  );
};
