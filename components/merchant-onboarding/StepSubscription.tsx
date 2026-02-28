import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, CheckCircle2, Gauge, Tags } from 'lucide-react';
import { SubscriptionTier, User } from '../../types';
import { subscriptionService } from '../../services/subscriptionService';
import { merchantSubscriptionService } from '../../services/merchantSubscriptionService';
import { floatIn } from './floatIn';

interface StepSubscriptionProps {
  user: User;
  setUser: (user: User) => void;
  onComplete: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepSubscription: React.FC<StepSubscriptionProps> = ({
  user, setUser, onComplete, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [tierToConfirm, setTierToConfirm] = useState<SubscriptionTier | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    subscriptionService.getSubscriptionTiers()
      .then((data) => setTiers(data))
      .catch((err) => setError(err.message || 'Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (tier: SubscriptionTier) => {
    setTierToConfirm(tier);
    setShowConfirm(true);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!tierToConfirm || !user.id) return;
    setShowConfirm(false);
    setSelecting(true);
    setSelectedTierId(tierToConfirm.id);
    setError(null);

    try {
      const result = await merchantSubscriptionService.createSubscription(
        user.id, tierToConfirm.id, tierToConfirm.tier_key, tierToConfirm.tier_name
      );

      if (result.success) {
        setUser({
          ...user,
          hasActiveSubscription: true,
          subscription_status: 'active',
          current_tier_id: tierToConfirm.id,
        });
        onComplete();
      } else {
        setError(result.error || 'Failed to activate subscription.');
        setSelecting(false);
        setSelectedTierId(null);
      }
    } catch (err: any) {
      setError(err.message || 'Subscription failed.');
      setSelecting(false);
      setSelectedTierId(null);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-5">
      <div style={floatIn(0, visible)} className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-emerald-500" />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Choose your plan
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Select a subscription to get started
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : error && tiers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <p className={`text-sm text-center ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              subscriptionService.getSubscriptionTiers()
                .then((data) => setTiers(data))
                .catch((err) => setError(err.message || 'Failed to load plans'))
                .finally(() => setLoading(false));
            }}
            className="h-12 px-6 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {tiers.map((tier, i) => (
            <div
              key={tier.id}
              style={floatIn(150 + i * 100, visible)}
              className={`p-4 rounded-xl border transition-all ${
                selectedTierId === tier.id
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : isDark
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {tier.tier_name}
                </h3>
                <span className="text-lg font-bold text-emerald-500">
                  {tier.currency}{tier.subscription_fee}
                  <span className={`text-xs font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    /{tier.billing_frequency}
                  </span>
                </span>
              </div>

              <div className={`flex items-center gap-4 text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5" /> {tier.max_campaigns_per_month} deals/mo
                </span>
                <span className="flex items-center gap-1">
                  <Tags className="w-3.5 h-3.5" /> {tier.max_dotd_per_month} DOTD/mo
                </span>
              </div>

              <button
                onClick={() => handleSelect(tier)}
                disabled={selecting}
                className={`w-full h-10 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] ${
                  selecting && selectedTierId === tier.id
                    ? 'bg-emerald-500 text-white opacity-70'
                    : 'bg-slate-900 text-white'
                }`}
              >
                {selecting && selectedTierId === tier.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  'Select Plan'
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && tierToConfirm && (
        <div className="fixed inset-0 z-[2000] bg-black/50 flex items-center justify-center p-6">
          <div className={`w-full max-w-sm p-6 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Confirm Subscription
            </h3>
            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              You're selecting <strong>{tierToConfirm.tier_name}</strong> at{' '}
              <strong>{tierToConfirm.currency}{tierToConfirm.subscription_fee}/{tierToConfirm.billing_frequency}</strong>
            </p>
            <div className={`space-y-2 mb-6 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {tierToConfirm.max_campaigns_per_month} deals per month
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {tierToConfirm.max_dotd_per_month} deal-of-day per month
              </div>
              {tierToConfirm.is_multi_store && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Multi-store support
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className={`flex-1 h-12 rounded-xl text-sm font-semibold ${
                  isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={floatIn(600, visible)} className="mt-auto pb-8 pt-4">
        <button
          onClick={onBack}
          className={`w-full h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Back
        </button>
      </div>
    </div>
  );
};
