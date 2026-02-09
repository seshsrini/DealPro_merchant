
import React, { useState, useEffect } from 'react';
import { 
  AppView, 
  SubscriptionTier, 
  User 
} from './types';
import { subscriptionService } from './services/subscriptionService';
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
  BadgeDollarSign
} from 'lucide-react';

interface MerchantSubscriptionsProps {
  user: User;
  setView: (view: AppView) => void;
}

export const MerchantSubscriptions: React.FC<MerchantSubscriptionsProps> = ({ user, setView }) => {
  const { t } = useTranslation();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTiers = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedTiers = await subscriptionService.getSubscriptionTiers();
        setTiers(fetchedTiers);
      } catch (err: any) {
        console.error("Failed to fetch subscription tiers:", err);
        setError(err.message || "Failed to load subscription plans. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (user.isLoggedIn && user.role === 'merchant') {
      fetchTiers();
    } else {
      setError("Unauthorized access. Please log in as a merchant.");
      setLoading(false);
    }
  }, [user.isLoggedIn, user.role]);

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
        <div className="grid grid-cols-1 gap-6">
          {tiers.map((tier) => (
            <div 
              key={tier.id} 
              className="glass p-8 rounded-[3rem] border-white/10 bg-slate-900/40 shadow-2xl space-y-6 animate-reveal"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black uppercase text-white tracking-tighter">{tier.tier_name}</h3>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                  <Zap className="w-3 h-3 text-blue-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                    {tier.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{tier.description}</p>

              <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                <div className="flex flex-col items-start gap-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500">Subscription Fee</p>
                    <p className="text-xl font-black text-white leading-none">{tier.currency} {tier.subscription_fee}</p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                    <CalendarDays className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase text-slate-500">Billing Frequency</p>
                    <p className="text-xl font-black text-white leading-none">{tier.billing_frequency}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-white/10 pt-6">
                <p className="text-[9px] font-black uppercase text-slate-500">Features</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-white">
                  <li className="flex items-start gap-3">
                    <Gauge className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Max Deals:</span>
                      <span className="font-bold text-white text-base leading-tight mt-0.5">{tier.max_campaigns_per_month}/month</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Tags className="w-4 h-4 text-amber-400 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Max Deal-of-Day:</span>
                      <span className="font-bold text-white text-base leading-tight mt-0.5">{tier.max_dotd_per_month}/month</span>
                    </div>
                  </li>
                  <li className="flex items-center gap-3">
                    {tier.is_multi_store ? 
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                      <X className="w-4 h-4 text-rose-500" />
                    }
                    Multi-Store Support
                  </li>
                  {Object.entries(tier.features).map(([key, value]) => (
                    <li key={key} className="flex items-center gap-3">
                      {value ? 
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                        <X className="w-4 h-4 text-rose-500" />
                      }
                      <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                  {tier.trial_period_days > 0 && (
                    <li className="flex items-center gap-3 col-span-full">
                      <CalendarDays className="w-4 h-4 text-purple-400" />
                      Free Trial: <span className="font-bold text-purple-300">{tier.trial_period_days} days</span>
                    </li>
                  )}
                </ul>
              </div>

              <button className="w-full btn-premium h-16 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                <BadgeDollarSign className="w-6 h-6" />
                <span className="text-[12px] font-black uppercase tracking-widest">Choose Plan</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};