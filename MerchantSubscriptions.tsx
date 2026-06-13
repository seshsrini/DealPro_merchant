
import React, { useState, useEffect, useCallback } from 'react';
import {
  AppView,
  SubscriptionTier,
  User
} from './types';
import { Capacitor } from '@capacitor/core';
import { subscriptionService } from './services/subscriptionService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { razorpayCheckoutService } from './services/razorpayCheckoutService';
import { supabase } from './services/supabaseClient';
import { useTranslation } from './contexts/LanguageContext';
import {
  Loader2,
  CheckCircle2,
  X,
  Info,
  CreditCard,
  Gauge,
  Tags,
  BadgeDollarSign,
  Clock,
  Gift,
  CalendarDays,
  ExternalLink,
  Shield,
} from 'lucide-react';

interface MerchantSubscriptionsProps {
  user: User;
  setView: (view: AppView) => void;
  setUser: (user: User) => void;
  theme?: 'light' | 'dark';
}

const GOOGLE_PLAY_SUBS_URL = 'https://play.google.com/store/account/subscriptions';

export const MerchantSubscriptions: React.FC<MerchantSubscriptionsProps> = ({ user, setView, setUser, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const isNative = Capacitor.isNativePlatform();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tierToConfirm, setTierToConfirm] = useState<SubscriptionTier | null>(null);
  const [currentTierId, setCurrentTierId] = useState<number | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  // ── Derived subscription info ──
  const isTrialing = currentSubscription?.status === 'active' &&
    currentSubscription?.current_period_end &&
    new Date(currentSubscription.current_period_end) > new Date() &&
    currentSubscription?.billing_type === 'google_play';
  const trialEndDate = currentSubscription?.current_period_end
    ? new Date(currentSubscription.current_period_end)
    : null;
  const daysRemaining = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / 86400000))
    : null;
  const currentTier = tiers.find(t => t.id === currentTierId);
  const recurringAmount = currentSubscription?.total_recurring_amount
    || currentTier?.subscription_fee
    || null;

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedTiers = await subscriptionService.getSubscriptionTiers();
      setTiers(fetchedTiers);

      const { tier_id, subscription } = await merchantSubscriptionService.fetchCurrentSubscription(user.id);
      setCurrentTierId(tier_id);
      setCurrentSubscription(subscription);
    } catch (err: any) {
      console.error('[MerchantSubscriptions] Fetch error:', err);
      setError('Unable to load subscription plans. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (user.isLoggedIn && user.role === 'merchant') {
      fetchData();
    } else {
      setError('Unauthorized access. Please log in as a merchant.');
      setLoading(false);
    }
  }, [user.isLoggedIn, user.role, fetchData]);

  // ── Supabase Realtime: listen for subscription changes ──
  useEffect(() => {
    if (!user.id) return;

    const channel = supabase
      .channel(`merchant_sub_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'merchant_subscriptions',
          filter: `merchant_id=eq.${user.id}`,
        },
        (payload: any) => {
          console.log('[MerchantSubscriptions] Realtime update:', payload.eventType);
          const row = payload.new;
          if (row) {
            setCurrentSubscription(row);
            // Update user state if status changed
            const isActive = row.status === 'active' &&
              row.current_period_end &&
              new Date(row.current_period_end) > new Date();
            setUser({
              ...user,
              hasActiveSubscription: isActive,
              subscription_status: row.status,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id, setUser]);

  const handleShowConfirmation = (tier: SubscriptionTier) => {
    setTierToConfirm(tier);
    setShowConfirmation(true);
    setError(null);
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setTierToConfirm(null);
  };

  const handleConfirmSelection = async () => {
    if (!tierToConfirm || !user.id) {
      setError('User not logged in');
      return;
    }

    const tier = tierToConfirm;
    setShowConfirmation(false);
    setSelecting(true);
    setSelectedTierId(tier.id);
    setError(null);

    try {
      const result = await merchantSubscriptionService.createSubscription(
        user.id, tier.id, tier.tier_key, tier.tier_name
      );

      if (result.success) {
        setCurrentTierId(tier.id);
        setCurrentSubscription(null);
        setSelecting(false);
        setSelectedTierId(null);
        setUser({
          ...user,
          hasActiveSubscription: true,
          subscription_status: 'active',
          current_tier_id: tier.id,
        });
        // Re-fetch to get full subscription details
        fetchData();
      } else {
        setError(result.error || 'Failed to activate subscription. Please try again.');
        setSelecting(false);
        setSelectedTierId(null);
      }
    } catch (err: any) {
      setError('An unexpected error occurred. Please try again.');
      setSelecting(false);
      setSelectedTierId(null);
    }
  };

  // Opens Razorpay Checkout in-app via services/razorpayCheckoutService. That
  // service calls Supabase Edge Functions `create-subscription` and
  // `verify-subscription`, then dispatches a 'dealpro:paid' CustomEvent which
  // App.tsx listens to and starts polling merchant_subscriptions for active.
  const handlePayWithRazorpay = async () => {
    if (!tierToConfirm || !user.id) return;
    setShowConfirmation(false);
    setNoticeMsg(null);

    // Already-active merchant changing plan → park the change for the NEXT cycle
    // (no new mandate, no immediate charge — the existing Autopay mandate covers
    // it and the billing run applies the new amount next cycle). New/expired
    // merchant → register a fresh mandate via the web checkout.
    const hasActive = currentSubscription?.status === 'active';
    if (hasActive && tierToConfirm.id !== currentTierId) {
      try {
        const res = await merchantSubscriptionService.changeTier(tierToConfirm.tier_key);
        if (!res.success) throw new Error(res.error || 'change failed');
        setNoticeMsg(res.message || 'Your plan change takes effect on your next billing date.');
        await fetchData();
      } catch (err) {
        console.error('[MerchantSubscriptions] change_tier failed:', err);
        setError('Could not change your plan. Please try again.');
      }
      return;
    }

    try {
      await razorpayCheckoutService.openCheckout({
        tierKey: tierToConfirm.tier_key,
        merchantId: user.id,
      });
    } catch (err) {
      console.error('[MerchantSubscriptions] Razorpay checkout open failed:', err);
      setError('Could not open the payment page. Please try again.');
    }
  };

  const handleManageSubscription = () => {
    if (isNative) {
      // Use Capacitor Browser to open Google Play subscriptions
      import('@capacitor/browser').then(({ Browser }) => {
        Browser.open({ url: GOOGLE_PLAY_SUBS_URL });
      }).catch(() => {
        window.open(GOOGLE_PLAY_SUBS_URL, '_blank');
      });
    } else {
      window.open(GOOGLE_PLAY_SUBS_URL, '_blank');
    }
  };

  return (
    <div className="px-6 pt-6 pb-32 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            My Subscription
          </h2>
          <p className={`text-sm font-medium mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('m_manage_plan')}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
          <CreditCard className="w-5 h-5 text-blue-500" />
        </div>
      </div>

      {/* Plan-change confirmation (takes effect next cycle) */}
      {noticeMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {noticeMsg}
        </div>
      )}

      {/* ════════════════════════════════════════════
          SUBSCRIPTION STATUS CARD
         ════════════════════════════════════════════ */}
      {currentSubscription && currentTierId && !loading && (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200'}`}>

          {/* Free Trial Badge */}
          {isTrialing && daysRemaining !== null && daysRemaining > 0 && (
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-white" />
                <span className="text-white text-xs font-bold tracking-wide uppercase">{t('m_free_trial')}</span>
              </div>
              <span className="text-white/90 text-xs font-semibold">
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
          )}

          {/* Active (non-trial) badge */}
          {currentSubscription.status === 'active' && !isTrialing && (
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2.5 flex items-center gap-2">
              <Shield className="w-4 h-4 text-white" />
              <span className="text-white text-xs font-bold tracking-wide uppercase">{t('m_active_subscription')}</span>
            </div>
          )}

          {/* Plan details */}
          <div className="p-4 space-y-4">
            {/* Plan name + amount */}
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentTier?.tier_name || currentSubscription.plan_name} Plan
                </p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {currentTier?.billing_frequency || 'monthly'}
                </p>
              </div>
              {recurringAmount && (
                <div className="text-right">
                  <p className="text-xl font-bold text-emerald-500">
                    ₹{recurringAmount}
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/month after trial</p>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className={`grid grid-cols-2 gap-3`}>
              {/* Days Remaining */}
              {daysRemaining !== null && (
                <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className={`w-3.5 h-3.5 ${daysRemaining <= 7 ? 'text-amber-500' : 'text-emerald-500'}`} />
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_days_remaining')}</p>
                  </div>
                  <p className={`text-2xl font-black ${
                    daysRemaining <= 3 ? 'text-red-500' : daysRemaining <= 7 ? 'text-amber-500' : isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    {daysRemaining}
                  </p>
                </div>
              )}

              {/* Next Billing Date */}
              {trialEndDate && (
                <div className={`rounded-xl p-3 ${isDark ? 'bg-slate-900/60' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <CalendarDays className={`w-3.5 h-3.5 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_next_billing')}</p>
                  </div>
                  <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {trialEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>

            {/* Features row */}
            {currentTier && (
              <div className={`flex items-center gap-4 px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span className="flex items-center gap-1.5 text-xs">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  {currentTier.max_campaigns_per_month} deals/mo
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Tags className="w-3.5 h-3.5 text-amber-400" />
                  {currentTier.max_dotd_per_month} DOTD/mo
                </span>
                {currentTier.is_multi_store && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Multi-store
                  </span>
                )}
              </div>
            )}

            {/* Manage Subscription button */}
            <button
              onClick={handleManageSubscription}
              className={`w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                isDark ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              Manage Subscription
            </button>

            {/* Cancel link */}
            {!currentSubscription.cancel_at_period_end ? (
              <button
                onClick={() => { setCancelReason(''); setShowCancelModal(true); }}
                className={`w-full text-center text-xs underline underline-offset-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
              >
                Cancel my subscription
              </button>
            ) : (
              <p className={`text-center text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                Your subscription will end on{' '}
                {new Date(currentSubscription.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          AVAILABLE PLANS TABLE
         ════════════════════════════════════════════ */}
      {!loading && (
        <div>
          <h3 className={`text-base font-semibold mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {currentTierId ? t('m_switch_plan') : t('m_choose_plan')}
          </h3>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading plans...</p>
        </div>
      ) : error && tiers.length === 0 ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <X className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_error_loading')}</p>
          <p className={`text-sm px-10 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{error}</p>
        </div>
      ) : tiers.length === 0 ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <Info className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
          <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_no_plans')}</p>
          <p className={`text-sm px-10 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Please check back later.</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-visible ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {/* Table Header */}
          <div className={`grid grid-cols-12 gap-3 px-4 py-3 border-b ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="col-span-3">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_plan')}</p>
            </div>
            <div className="col-span-2">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_price')}</p>
            </div>
            <div className="col-span-2">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_deals')}</p>
            </div>
            <div className="col-span-2">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_dotd_short')}</p>
            </div>
            <div className="col-span-3"></div>
          </div>

          {/* Table Rows */}
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              className={`grid grid-cols-12 gap-3 px-4 py-4 items-center transition-colors ${
                index !== tiers.length - 1 ? (isDark ? 'border-b border-slate-800/50' : 'border-b border-slate-100') : ''
              }`}
            >
              <div className="col-span-3">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tier.tier_name}</p>
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{tier.billing_frequency}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-emerald-500">
                  {tier.currency} {tier.subscription_fee}
                </p>
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{tier.max_campaigns_per_month}</span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/mo</span>
                </div>
              </div>
              <div className="col-span-2">
                <div className="flex items-center gap-1.5">
                  <Tags className="w-4 h-4 text-amber-400" />
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{tier.max_dotd_per_month}</span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/mo</span>
                </div>
              </div>
              <div className="col-span-3 flex justify-end">
                {currentTierId === tier.id ? (
                  <span className="px-3 h-8 rounded-lg bg-emerald-500 text-white font-semibold text-[11px] flex items-center">
                    Current
                  </span>
                ) : (
                  <button
                    onClick={() => handleShowConfirmation(tier)}
                    disabled={selecting && selectedTierId === tier.id}
                    className="px-4 h-8 rounded-lg font-semibold text-[11px] active:scale-[0.98] transition-all disabled:opacity-50 bg-slate-900 text-white"
                  >
                    {selecting && selectedTierId === tier.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      t('m_select')
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error banner (non-blocking) */}
      {error && tiers.length > 0 && (
        <div className={`p-3 rounded-xl text-sm text-center ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
          {error}
        </div>
      )}

      {/* ═══ Cancel Subscription Modal ═══ */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className={`max-w-sm w-full rounded-2xl p-6 space-y-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_cancel_sub')}</h3>

            <div className={`rounded-xl p-4 border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
                If you cancel now, your active deals will remain live until{' '}
                <span className="font-semibold">
                  {currentSubscription?.current_period_end
                    ? new Date(currentSubscription.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  }
                </span>
                , but you won't be able to post new promotions or update your product catalogue.
              </p>
            </div>

            <div>
              <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Reason for cancellation
              </label>
              <select
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className={`w-full h-11 px-3 rounded-lg text-sm border outline-none ${
                  isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="">{t('m_select_reason')}</option>
                <option value="too_expensive">{t('m_reason_expensive')}</option>
                <option value="not_enough_features">{t('m_reason_features')}</option>
                <option value="business_closed">Business closed / seasonal</option>
                <option value="switching_platform">{t('m_reason_switching')}</option>
                <option value="not_seeing_results">{t('m_reason_results')}</option>
                <option value="technical_issues">{t('m_reason_technical')}</option>
                <option value="other">{t('m_subj_other')}</option>
              </select>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowCancelModal(false)}
                className={`flex-1 h-11 rounded-xl text-sm font-medium border active:scale-[0.98] transition-all ${
                  isDark ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-900'
                }`}
              >
                Keep Plan
              </button>
              <button
                disabled={!cancelReason || cancelling}
                onClick={async () => {
                  setCancelling(true);
                  try {
                    const result = await merchantSubscriptionService.cancelSubscription(user.id, cancelReason);
                    if (result.success) {
                      setShowCancelModal(false);
                      setCurrentSubscription((prev: any) => prev ? { ...prev, cancel_at_period_end: true } : prev);
                    } else {
                      setError('Unable to cancel subscription. Please try again.');
                      setShowCancelModal(false);
                    }
                  } catch {
                    setError('Unable to cancel subscription. Please try again.');
                    setShowCancelModal(false);
                  } finally {
                    setCancelling(false);
                  }
                }}
                className="flex-1 h-11 rounded-xl bg-rose-600 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : t('m_cancel_sub')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Confirmation Modal ═══ */}
      {showConfirmation && tierToConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className={`max-w-md w-full rounded-2xl p-6 space-y-5 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="text-center">
              <div className={`w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <BadgeDollarSign className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Confirm Subscription
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                You're about to subscribe to:
              </p>
            </div>

            <div className={`rounded-xl border p-5 space-y-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_plan')}</p>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tierToConfirm.tier_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_price')}</p>
                  <p className="text-lg font-semibold text-emerald-500">
                    {tierToConfirm.currency} {tierToConfirm.subscription_fee}
                  </p>
                </div>
                <div>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_billing')}</p>
                  <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tierToConfirm.billing_frequency}</p>
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('m_features')}</p>
                <ul className={`space-y-1.5 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {tierToConfirm.max_campaigns_per_month} deals per month
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {tierToConfirm.max_dotd_per_month} deal-of-day per month
                  </li>
                  {tierToConfirm.is_multi_store && (
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Multi-store support
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelConfirmation}
                className={`flex-1 h-12 rounded-xl text-sm font-medium border active:scale-[0.98] transition-all ${
                  isDark ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-900'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelection}
                className="flex-1 h-12 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t('m_confirm')}</span>
              </button>
            </div>

            {/* Razorpay path — opens VedicJaalam /subscribe in an external browser. */}
            <button
              onClick={handlePayWithRazorpay}
              className="w-full h-11 rounded-xl bg-amber-500 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <CreditCard className="w-4 h-4" />
              Pay with Razorpay (test)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
