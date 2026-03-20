import React, { useState, useEffect } from 'react';
import { Heart, Loader2, CheckCircle2, Store, Users, TrendingUp } from 'lucide-react';
import { User } from '../../types';
import { merchantSubscriptionService } from '../../services/merchantSubscriptionService';
import { floatIn } from './floatIn';

interface StepLoyaltyAddonProps {
  user: User;
  subscriptionFee: number;
  subscriptionId: number | null;
  onComplete: () => void;
  onSkip: () => void;
  theme: 'light' | 'dark';
}

const LOYALTY_ADDON_PRICE = 10;

export const StepLoyaltyAddon: React.FC<StepLoyaltyAddonProps> = ({
  user, subscriptionFee, subscriptionId: passedSubscriptionId, onComplete, onSkip, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedSubId, setResolvedSubId] = useState<number | null>(passedSubscriptionId);
  const [resolvedFee, setResolvedFee] = useState<number>(subscriptionFee);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Fetch active subscription if ID wasn't passed from previous step
  useEffect(() => {
    if (resolvedSubId || !user.id) return;
    merchantSubscriptionService.fetchCurrentSubscription(user.id).then((result) => {
      if (result.subscription) {
        setResolvedSubId(result.subscription.id);
        if (!resolvedFee && result.subscription.plan_name) {
          // Fee was already passed from StepSubscription, but if 0, leave it
        }
      }
    }).catch(() => {});
  }, [user.id, resolvedSubId, resolvedFee]);

  const handleEnroll = async () => {
    if (!user.id) return;

    // If we still don't have a subscription ID, fetch it now
    let subId = resolvedSubId;
    if (!subId) {
      try {
        const result = await merchantSubscriptionService.fetchCurrentSubscription(user.id);
        subId = result.subscription?.id || null;
        if (subId) setResolvedSubId(subId);
      } catch {}
    }

    if (!subId) {
      setError('Unable to find your subscription. Please try again.');
      return;
    }

    setEnrolling(true);
    setError(null);

    try {
      const result = await merchantSubscriptionService.addLoyaltyAddon(
        user.id, subId, resolvedFee
      );

      if (result.success) {
        onComplete();
      } else {
        setError(result.error || 'Unable to enroll. Please try again.');
        setEnrolling(false);
      }
    } catch {
      setError('Unable to enroll. Please try again.');
      setEnrolling(false);
    }
  };

  const totalAmount = resolvedFee + LOYALTY_ADDON_PRICE;

  return (
    <div className="flex flex-col min-h-full px-6 pt-5">
      {/* Header */}
      <div style={floatIn(0, visible)} className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
          <Heart className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Consumer Loyalty Program
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Become a redemption partner
          </p>
        </div>
      </div>

      {/* Description */}
      <div style={floatIn(100, visible)} className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'}`}>
        <p className={`text-sm leading-relaxed ${isDark ? 'text-purple-200' : 'text-purple-800'}`}>
          Join DealPro's consumer loyalty program as a <strong>redemption partner</strong>.
          Consumers earn reward points on every deal and can redeem them at your store —
          driving repeat visits and increasing footfall.
        </p>
      </div>

      {/* Benefits */}
      <div style={floatIn(200, visible)} className="space-y-3 mb-5">
        <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
          <Users className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Attract new customers</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Consumers looking to redeem points will discover your store</p>
          </div>
        </div>
        <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
          <TrendingUp className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Increase repeat visits</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loyalty points encourage customers to come back</p>
          </div>
        </div>
        <div className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white border border-slate-200'}`}>
          <Store className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
          <div>
            <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Featured as redemption partner</p>
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your store appears in the loyalty redemption section of the consumer app</p>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div style={floatIn(300, visible)} className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your subscription</span>
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{resolvedFee}/month</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loyalty add-on</span>
          <span className="text-sm font-medium text-purple-500">+ ₹{LOYALTY_ADDON_PRICE}/month</span>
        </div>
        <div className={`border-t pt-2 mt-2 flex items-center justify-between ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Total</span>
          <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{totalAmount}/month</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className={`p-3 rounded-xl text-sm text-center mb-4 ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={floatIn(400, visible)} className="mt-auto pb-8 pt-4 space-y-3">
        <button
          onClick={handleEnroll}
          disabled={enrolling}
          className="w-full h-14 rounded-xl bg-purple-600 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {enrolling ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Yes, enroll me for ₹{LOYALTY_ADDON_PRICE}/month
            </>
          )}
        </button>
        <button
          onClick={onSkip}
          disabled={enrolling}
          className={`w-full h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          No thanks, skip for now
        </button>
      </div>
    </div>
  );
};
