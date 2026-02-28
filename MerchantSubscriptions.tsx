
import React, { useState, useEffect } from 'react';
import {
  AppView,
  SubscriptionTier,
  User
} from './types';
import { subscriptionService } from './services/subscriptionService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
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
  HelpCircle
} from 'lucide-react';

interface MerchantSubscriptionsProps {
  user: User;
  setView: (view: AppView) => void;
  setUser: (user: User) => void;
  theme?: 'light' | 'dark';
}

export const MerchantSubscriptions: React.FC<MerchantSubscriptionsProps> = ({ user, setView, setUser, theme = 'dark' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedTiers = await subscriptionService.getSubscriptionTiers();
        setTiers(fetchedTiers);

        const { tier_id, subscription } = await merchantSubscriptionService.fetchCurrentSubscription(user.id);
        setCurrentTierId(tier_id);
        setCurrentSubscription(subscription);
      } catch (err: any) {
        console.error("Failed to fetch subscription tiers:", err);
        setError(err.message || "Failed to load subscription plans. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (user.isLoggedIn && user.role === 'merchant') {
      fetchData();
    } else {
      setError("Unauthorized access. Please log in as a merchant.");
      setLoading(false);
    }
  }, [user.isLoggedIn, user.role]);

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
      setError("User not logged in");
      return;
    }

    const tier = tierToConfirm;
    setShowConfirmation(false);
    setSelecting(true);
    setSelectedTierId(tier.id);
    setError(null);

    try {
      console.log("[MerchantSubscriptions] Creating subscription for tier:", tier.tier_name);

      const result = await merchantSubscriptionService.createSubscription(
        user.id,
        tier.id,
        tier.tier_key,
        tier.tier_name
      );

      if (result.success) {
        console.log("[MerchantSubscriptions] Subscription created successfully");

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
      } else {
        setError(result.error || "Failed to activate subscription. Please try again.");
        setSelecting(false);
        setSelectedTierId(null);
      }
    } catch (err: any) {
      console.error("[MerchantSubscriptions] Error selecting plan:", err);
      setError("An unexpected error occurred. Please try again.");
      setSelecting(false);
      setSelectedTierId(null);
    }
  };

  return (
    <div className="px-6 pt-6 pb-32 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Subscription Plans
          </h2>
          <p className={`text-sm font-medium mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Empower your business</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
          <CreditCard className="w-5 h-5 text-blue-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loading plans...</p>
        </div>
      ) : error ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <X className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Error Loading Plans</p>
          <p className={`text-sm px-10 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{error}</p>
        </div>
      ) : tiers.length === 0 ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <Info className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
          <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>No Subscription Plans Found</p>
          <p className={`text-sm px-10 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Please check back later or contact support.</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-visible ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {/* Table Header */}
          <div className={`grid grid-cols-12 gap-3 px-4 py-3 border-b ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="col-span-3">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Plan</p>
            </div>
            <div className="col-span-2">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Price</p>
            </div>
            <div className="col-span-2">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Deals</p>
            </div>
            <div className="col-span-2">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>DOTD</p>
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
              {/* Plan Name */}
              <div className="col-span-3">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tier.tier_name}</p>
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{tier.billing_frequency}</p>
              </div>

              {/* Price */}
              <div className="col-span-2">
                <p className="text-sm font-semibold text-emerald-500">
                  {tier.currency} {tier.subscription_fee}
                </p>
              </div>

              {/* Max Deals */}
              <div className="col-span-2">
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{tier.max_campaigns_per_month}</span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/mo</span>
                </div>
              </div>

              {/* Max DOTD */}
              <div className="col-span-2">
                <div className="flex items-center gap-1.5">
                  <Tags className="w-4 h-4 text-amber-400" />
                  <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{tier.max_dotd_per_month}</span>
                  <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/mo</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="col-span-3 flex justify-end">
                {currentTierId === tier.id ? (
                  <span className="px-3 h-8 rounded-lg bg-blue-500 text-white font-semibold text-[11px] flex items-center">
                    Active
                  </span>
                ) : (
                  <button
                    onClick={() => handleShowConfirmation(tier)}
                    disabled={selecting && selectedTierId === tier.id}
                    className="px-4 h-8 rounded-lg font-semibold text-[11px] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 text-white"
                  >
                    {selecting && selectedTierId === tier.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Select"
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Subscription Link */}
      {currentTierId && (
        <div className="text-center pt-2 pb-4">
          {currentSubscription?.cancel_at_period_end ? (
            <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
              Your subscription will end on {new Date(currentSubscription.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          ) : (
            <button
              onClick={() => { setCancelReason(''); setShowCancelModal(true); }}
              className="text-blue-500 text-xs underline underline-offset-2"
            >
              Cancel my subscription
            </button>
          )}
        </div>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className={`max-w-sm w-full rounded-2xl p-6 space-y-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Cancel Subscription</h3>

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
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              >
                <option value="">Select a reason</option>
                <option value="too_expensive">Too expensive</option>
                <option value="not_enough_features">Not enough features</option>
                <option value="business_closed">Business closed / seasonal</option>
                <option value="switching_platform">Switching to another platform</option>
                <option value="not_seeing_results">Not seeing results</option>
                <option value="technical_issues">Technical issues</option>
                <option value="other">Other</option>
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
                      setError(result.error || 'Failed to cancel subscription.');
                      setShowCancelModal(false);
                    }
                  } catch (err: any) {
                    setError(err.message || 'Cancellation failed.');
                    setShowCancelModal(false);
                  } finally {
                    setCancelling(false);
                  }
                }}
                className="flex-1 h-11 rounded-xl bg-rose-600 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
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
                You're about to subscribe to the following plan:
              </p>
            </div>

            <div className={`rounded-xl border p-5 space-y-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Plan</p>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tierToConfirm.tier_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Price</p>
                  <p className="text-lg font-semibold text-emerald-500">
                    {tierToConfirm.currency} {tierToConfirm.subscription_fee}
                  </p>
                </div>
                <div>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Billing</p>
                  <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tierToConfirm.billing_frequency}</p>
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Key Features</p>
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
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
