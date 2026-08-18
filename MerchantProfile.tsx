
import React, { useState, useEffect, useCallback } from 'react';
import {
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
  QrCode,
  Trophy,
  MessageSquareText,
  Settings,
  Crown,
  BarChart3,
  Users,
  Shield,
  FileText,
} from 'lucide-react';
import { AppView } from './types';
import { useTranslation } from './contexts/LanguageContext';
import { usePermissions } from './contexts/PermissionsContext';
import { userService } from './services/userService';
import { MreferralService } from './services/MreferralService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { supabase } from './services/supabaseClient';
import { resilient } from './services/resilientData';
import { useResumeRefetch } from './services/useResumeRefetch';
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
  const { can } = usePermissions();
  const isDark = theme === 'dark';
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);

  const [merchantReferralCode, setMerchantReferralCode] = useState(
    user.merchant_referral_code || user.my_referral_code || ''
  );
  const [referralCredits, setReferralCredits] = useState<{ qualified_referrals: number; available_months: number; referrals_to_next: number } | null>(null);

  // Referral free-month credits (5 referrals = 1 free month, carryover).
  // Resilient: retries + last-good cache so a resume-time blip doesn't blank it.
  const loadReferralCredits = useCallback(async () => {
    try {
      const c = await resilient(
        () => merchantSubscriptionService.getReferralCredits(),
        { cacheKey: `referral_credits_${user.id}` },
      );
      if (c) setReferralCredits(c);
    } catch {
      /* keep last-good */
    }
  }, [user.id]);

  useEffect(() => { loadReferralCredits(); }, [loadReferralCredits]);
  useResumeRefetch(loadReferralCredits);

  // Fetch from DB if not on user object
  useEffect(() => {
    if (!merchantReferralCode && user.id) {
      supabase
        .from('merchant_profiles')
        .select('merchant_referral_code')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.merchant_referral_code) setMerchantReferralCode(data.merchant_referral_code);
        });
    }
  }, [user.id, merchantReferralCode]);

  const handleInviteViaWhatsApp = async () => {
    setIsInviting(true);
    setShowInviteSuccess(false);

    try {
      const referralCode = merchantReferralCode;
      const storeName = user.store_name || user.username || 'DealFynd Merchant';

      await userService.logActivity({
        user_id: user.id,
        event_type: 'click',
        platform: 'mobile',
        metadata: { action: 'refer_partner', referral_code_used: referralCode }
      });

      await MreferralService.onInviteSent(user.id, referralCode, null, null);

      const message = `Hi! This is ${storeName}. I am using DealFynd to grow my business. Join using my code ${referralCode} and get started here: https://dealpro.app/signup?ref=${referralCode}`;
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

  // Initials from store name
  const initials = (user.store_name || user.username || 'M')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className={`px-5 pt-6 pb-32 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
      {/* Profile Header Card */}
      <div className={`rounded-2xl p-5 mb-5 ${isDark ? 'bg-slate-800/80' : 'bg-white'} ${isDark ? '' : 'shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold ${isDark ? 'bg-gradient-to-br from-indigo-500/20 to-blue-500/10 text-indigo-400' : 'bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-600'}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-lg font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{user.store_name || user.username}</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('profile_verified_merchant')}</span>
            </div>
          </div>
          <button
            onClick={() => setView('edit_profile')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}
          >
            <PenLine className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
          </button>
        </div>
      </div>

      {/* Referral Progress Card */}
      <button
        onClick={() => setView('referral_tracker')}
        className={`w-full rounded-2xl p-4 mb-5 text-left active:scale-[0.98] transition-all ${isDark ? 'bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-orange-500/10 border border-amber-500/20' : 'bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border border-amber-200/60'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Trophy size={22} className="text-amber-500" />
            </div>
            <div>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_referral_progress')}</p>
              <p className={`text-[10px] mt-0.5 font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                {referralCredits
                  ? (referralCredits.available_months > 0
                      ? t('m_ref_ready')
                          .replace('{qualified}', String(referralCredits.qualified_referrals))
                          .replace('{count}', String(referralCredits.available_months))
                      : t('m_ref_progress_line')
                          .replace('{qualified}', String(referralCredits.qualified_referrals))
                          .replace('{toNext}', String(referralCredits.referrals_to_next)))
                  : t('m_referral_track')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!!referralCredits && referralCredits.available_months > 0 && (
              <span className="bg-emerald-500 text-white text-[11px] font-bold px-2 py-1 rounded-full leading-none">
                {referralCredits.available_months}
              </span>
            )}
            <ChevronRight size={18} className={isDark ? 'text-slate-300' : 'text-slate-900'} />
          </div>
        </div>
      </button>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* My Stores — requires store.manage */}
        {can('store.manage') && (
          <button
            onClick={() => setView('merchant_stores')}
            className={`p-4 rounded-2xl flex flex-col items-start gap-3 transition-all active:scale-[0.97] active:shadow-none active:translate-y-0.5 ${isDark ? 'bg-slate-800/80 hover:bg-slate-800 shadow-md shadow-black/20' : 'bg-white hover:bg-slate-50 shadow-md shadow-slate-200/80'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-teal-500/10' : 'bg-teal-50'}`}>
              <MapPin className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_my_stores')}</p>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_manage_locations')}</p>
            </div>
          </button>
        )}

        {/* My Team — always visible (staff can view, only owner can manage) */}
        <button
          onClick={() => setView('merchant_team')}
          className={`p-4 rounded-2xl flex flex-col items-start gap-3 transition-all active:scale-[0.97] active:shadow-none active:translate-y-0.5 ${isDark ? 'bg-slate-800/80 hover:bg-slate-800 shadow-md shadow-black/20' : 'bg-white hover:bg-slate-50 shadow-md shadow-slate-200/80'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_my_team')}</p>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_manage_staff')}</p>
          </div>
        </button>

        {/* Refer Consumers — always visible */}
        <button
          onClick={() => setView('refer_consumer')}
          className={`p-4 rounded-2xl flex flex-col items-start gap-3 transition-all active:scale-[0.97] active:shadow-none active:translate-y-0.5 ${isDark ? 'bg-slate-800/80 hover:bg-slate-800 shadow-md shadow-black/20' : 'bg-white hover:bg-slate-50 shadow-md shadow-slate-200/80'}`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
            <QrCode className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_refer_consumers')}</p>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_print_qr')}</p>
          </div>
        </button>

        {/* My Subscriptions — requires subscription.manage */}
        {can('subscription.manage') && (
          <button
            onClick={() => setView('merchant_subscriptions')}
            className={`p-4 rounded-2xl flex flex-col items-start gap-3 transition-all active:scale-[0.97] active:shadow-none active:translate-y-0.5 ${isDark ? 'bg-slate-800/80 hover:bg-slate-800 shadow-md shadow-black/20' : 'bg-white hover:bg-slate-50 shadow-md shadow-slate-200/80'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
              <Crown className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_subscriptions')}</p>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_manage_plan')}</p>
            </div>
          </button>
        )}

        {/* Payment Plans — requires billing.manage */}
        {can('billing.manage') && (
          <button
            onClick={() => setView('payment_plans')}
            className={`p-4 rounded-2xl flex flex-col items-start gap-3 transition-all active:scale-[0.97] active:shadow-none active:translate-y-0.5 ${isDark ? 'bg-slate-800/80 hover:bg-slate-800 shadow-md shadow-black/20' : 'bg-white hover:bg-slate-50 shadow-md shadow-slate-200/80'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
              <CreditCard className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className={`text-sm font-semibold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_payments')}</p>
              <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_billing_invoices')}</p>
            </div>
          </button>
        )}
      </div>

      {/* Settings & Tours — compact row */}
      <div className={`rounded-2xl overflow-hidden mb-5 divide-y ${isDark ? 'bg-slate-800/80 divide-slate-700/50' : 'bg-white divide-slate-100 shadow-sm'}`}>
        {/* Edit Store Profile */}
        <button onClick={() => setView('edit_profile')} className="w-full px-4 py-3.5 flex items-center justify-between active:bg-black/5 transition-colors">
          <div className="flex items-center gap-3">
            <Settings className={`w-4.5 h-4.5 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_edit_store')}</span>
          </div>
          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
        </button>

        {/* Replay Feature Tour */}
        <button onClick={() => { resetFeatureTour(user.id); setView('merchant_dashboard'); }} className="w-full px-4 py-3.5 flex items-center justify-between active:bg-black/5 transition-colors">
          <div className="flex items-center gap-3">
            <PlayCircle className={`w-4.5 h-4.5 ${isDark ? 'text-cyan-400' : 'text-cyan-500'}`} />
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_replay_feature_tour')}</span>
          </div>
          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
        </button>

        {/* Replay Campaign Tour */}
        <button onClick={() => { resetCampaignTour(user.id); setView('merchant_deals'); }} className="w-full px-4 py-3.5 flex items-center justify-between active:bg-black/5 transition-colors">
          <div className="flex items-center gap-3">
            <PlayCircle className={`w-4.5 h-4.5 ${isDark ? 'text-violet-400' : 'text-violet-500'}`} />
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_replay_campaign_tour')}</span>
          </div>
          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
        </button>

        {/* Help & Support */}
        <button onClick={() => setView('help_feedback')} className="w-full px-4 py-3.5 flex items-center justify-between active:bg-black/5 transition-colors">
          <div className="flex items-center gap-3">
            <MessageSquareText className={`w-4.5 h-4.5 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_support_hub')}</span>
          </div>
          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
        </button>
      </div>

      {/* Invite a Partner Card */}
      <div className={`rounded-2xl p-5 mb-5 ${isDark ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/20' : 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60'}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-emerald-500/15' : 'bg-emerald-100'}`}>
            <Share2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('profile_invite_partner')}</p>
            <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_invite_whatsapp')}</p>
          </div>
        </div>

        {/* Referral Code */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
          <Zap className="w-4 h-4 text-blue-500" />
          <p className={`text-xs font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {t('m_your_code')} <span className="font-mono font-semibold">{merchantReferralCode}</span>
          </p>
        </div>

        <button
          onClick={handleInviteViaWhatsApp}
          disabled={isInviting}
          className="w-full h-11 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 hover:bg-emerald-700"
        >
          {isInviting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Share2 className="w-4 h-4" />
              {t('m_send_whatsapp')}
            </>
          )}
        </button>

        {showInviteSuccess && (
          <div className="flex items-center gap-2 mt-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <p className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {t('profile_invite_success')}
            </p>
          </div>
        )}
      </div>

      {/* Legal Links */}
      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={() => setView('privacy_policy')}
          className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98] ${isDark ? 'bg-slate-800/50 hover:bg-slate-800 text-slate-300' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'}`}
        >
          <div className="flex items-center gap-3">
            <Shield className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
            <span className="text-sm font-medium">{t('m_privacy_policy')}</span>
          </div>
          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
        </button>
        <button
          onClick={() => setView('terms_of_service')}
          className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98] ${isDark ? 'bg-slate-800/50 hover:bg-slate-800 text-slate-300' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'}`}
        >
          <div className="flex items-center gap-3">
            <FileText className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
            <span className="text-sm font-medium">{t('m_terms_of_service')}</span>
          </div>
          <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
        </button>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_copyright')}</p>
        {/* Build stamp — lets a tester confirm at a glance they're on the latest web
            build (baked in at build time; a stale APK shows an old value here). */}
        <p className={`mt-1 text-[9px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Build {__BUILD_ID__}</p>
      </div>
    </div>
  );
};
