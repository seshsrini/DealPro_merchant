
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
  Zap,
  CheckCircle2,
  X,
  Info,
  CreditCard,
  ChevronRight,
  Store,
  DollarSign,
  CalendarDays,
  Gauge,
  Tags,
  BadgeDollarSign,
  HelpCircle
} from 'lucide-react';

interface MerchantSubscriptionsProps {
  user: User;
  setView: (view: AppView) => void;
  setUser: (user: User) => void;
}

export const MerchantSubscriptions: React.FC<MerchantSubscriptionsProps> = ({ user, setView, setUser }) => {
  const { t } = useTranslation();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tierToConfirm, setTierToConfirm] = useState<SubscriptionTier | null>(null);
  const [currentTierId, setCurrentTierId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch subscription tiers
        const fetchedTiers = await subscriptionService.getSubscriptionTiers();
        setTiers(fetchedTiers);

        // Fetch current subscription
        const { tier_id } = await merchantSubscriptionService.fetchCurrentSubscription();
        setCurrentTierId(tier_id);
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

        // Update local state with current tier
        setCurrentTierId(tier.id);

        // Update user state with active subscription
        setUser({
          ...user,
          hasActiveSubscription: true,
          subscription_status: 'active',
          current_tier_id: tier.id,
        });

        // Navigate to merchant dashboard
        setView('merchant_dashboard');
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
    <div className="px-6 pt-6 pb-32 animate-reveal space-y-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white">
            Subscription<br /><span className="text-blue-500">Plans</span>
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Empower Your Business</p>
          </div>
        </div>
        <button 
          onClick={() => setView('profile')} 
          className="w-14 h-14 glass rounded-2xl flex items-center justify-center border-white/10 active:scale-90 transition-transform"
        >
          <CreditCard className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Syncing Plans...</p>
        </div>
      ) : error ? (
        <div className="text-center py-24 glass rounded-[3.5rem] border-rose-500/20 bg-rose-500/5 shadow-2xl">
          <X className="w-16 h-16 text-rose-500 mx-auto mb-6" />
          <p className="text-xl font-black text-white uppercase tracking-tighter mb-2">Error Loading Plans</p>
          <p className="text-xs font-bold text-slate-400 px-10">{error}</p>
        </div>
      ) : tiers.length === 0 ? (
        <div className="text-center py-24 glass rounded-[3.5rem] border-white/5 bg-slate-950/40 shadow-2xl">
          <Info className="w-16 h-16 text-slate-700 mx-auto mb-6" />
          <p className="text-xl font-black text-white uppercase tracking-tighter mb-2">No Subscription Plans Found</p>
          <p className="text-xs font-bold text-slate-400 px-10">Please check back later or contact support.</p>
        </div>
      ) : (
        <div className="glass rounded-3xl border-white/10 bg-slate-900/40 shadow-2xl overflow-visible">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-3 px-6 py-4 bg-slate-950/60 border-b border-white/10">
            <div className="col-span-3">
              <div className="flex items-center gap-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Plan</p>
                <div className="cursor-help group relative">
                  <HelpCircle className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  {/* Plan Tooltip */}
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-[9999] animate-reveal">
                    <div className="bg-slate-900 border border-white/20 rounded-xl px-3 py-2 shadow-2xl w-[260px]">
                      <p className="text-xs font-bold text-white leading-relaxed whitespace-nowrap">
                        Subscription Plans
                      </p>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        Choose a plan based on your monthly<br />
                        needs. Deals: regular promotions. DOTD:<br />
                        premium single-day featured deals with<br />
                        maximum visibility and user engagement.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-2">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Price</p>
            </div>
            <div className="col-span-2">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Deals</p>
            </div>
            <div className="col-span-2">
              <div className="flex items-center gap-1">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">DOTD</p>
                <div className="cursor-help group relative">
                  <HelpCircle className="w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  {/* Custom Tooltip */}
                  <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block z-[9999] animate-reveal">
                    <div className="bg-slate-900 border border-white/20 rounded-xl px-3 py-2 shadow-2xl w-[240px]">
                      <p className="text-xs font-bold text-white leading-relaxed whitespace-nowrap">
                        Deal of the Day
                      </p>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        A promotional deal that runs for a<br />
                        single day giving maximum visibility.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-3"></div>
          </div>

          {/* Table Rows */}
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              className={`grid grid-cols-12 gap-3 px-6 py-5 items-center hover:bg-slate-800/30 transition-colors ${
                index !== tiers.length - 1 ? 'border-b border-white/5' : ''
              }`}
            >
              {/* Plan Name */}
              <div className="col-span-3">
                <p className="text-sm font-black text-white tracking-tight">{tier.tier_name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{tier.billing_frequency}</p>
              </div>

              {/* Price */}
              <div className="col-span-2">
                <p className="text-base font-black text-emerald-400">
                  {tier.currency} {tier.subscription_fee}
                </p>
              </div>

              {/* Max Deals */}
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-bold text-white">{tier.max_campaigns_per_month}</span>
                  <span className="text-[10px] text-slate-500">/month</span>
                </div>
              </div>

              {/* Max DOTD */}
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <Tags className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-white">{tier.max_dotd_per_month}</span>
                  <span className="text-[10px] text-slate-500">/month</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="col-span-3 flex justify-end">
                {currentTierId === tier.id ? (
                  <button
                    disabled
                    className="px-4 h-8 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold text-[11px] uppercase tracking-wide shadow-md cursor-default"
                  >
                    Selected
                  </button>
                ) : (
                  <button
                    onClick={() => handleShowConfirmation(tier)}
                    disabled={selecting && selectedTierId === tier.id}
                    className="px-4 h-8 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-[11px] uppercase tracking-wide hover:from-amber-500 hover:to-amber-400 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
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

      {/* Confirmation Modal */}
      {showConfirmation && tierToConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-reveal">
          <div className="glass max-w-md w-full rounded-[3rem] border-white/10 bg-slate-900/90 shadow-2xl p-8 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <BadgeDollarSign className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-2xl font-black uppercase text-white tracking-tighter mb-2">
                Confirm Subscription
              </h3>
              <p className="text-xs font-bold text-slate-400">
                You're about to subscribe to the following plan:
              </p>
            </div>

            <div className="glass rounded-2xl border-white/5 bg-slate-950/40 p-6 space-y-4">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Plan</p>
                <p className="text-xl font-black text-white">{tierToConfirm.tier_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Price</p>
                  <p className="text-lg font-black text-emerald-400">
                    {tierToConfirm.currency} {tierToConfirm.subscription_fee}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-slate-500 mb-1">Billing</p>
                  <p className="text-lg font-black text-white">{tierToConfirm.billing_frequency}</p>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500 mb-2">Key Features</p>
                <ul className="space-y-1 text-sm text-slate-300">
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
                className="flex-1 h-14 rounded-2xl glass border-white/10 text-white font-black text-sm uppercase tracking-wider active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelection}
                className="flex-1 h-14 rounded-2xl btn-premium shadow-xl shadow-blue-500/20 active:scale-95 transition-transform"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-black text-sm uppercase tracking-wider">Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};