import React, { useCallback, useEffect, useState } from 'react';
import { Heart, Loader2, CheckCircle2, Store, Users, TrendingUp, CreditCard, X } from 'lucide-react';
import { User } from '../../types';
import { razorpayCheckoutService } from '../../services/razorpayCheckoutService';
import { floatIn } from './floatIn';

interface StepLoyaltyAddonProps {
  user: User;
  subscriptionFee: number;
  tierKey: string | null;
  onComplete: () => void;
  theme: 'light' | 'dark';
}

const LOYALTY_ADDON_PRICE = 10;

type Choice = 'with_loyalty' | 'without_loyalty';

// Loyalty step. The two main buttons open an in-app confirmation popup with
// the chosen breakdown; the user reviews it and taps "Pay with Razorpay
// (test)" inside the popup to hand off to VedicJaalam's /subscribe page.
// After payment, App.tsx's activation polling flips user.hasActiveSubscription
// and the useEffect below auto-advances to congrats.
export const StepLoyaltyAddon: React.FC<StepLoyaltyAddonProps> = ({
  user, subscriptionFee, tierKey, onComplete, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const [confirm, setConfirm] = useState<Choice | null>(null);
  const [pending, setPending] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Activation succeeded → advance.
  useEffect(() => {
    if (!pending) return;
    if (!user.hasActiveSubscription) return;
    setPending(null);
    onComplete();
  }, [pending, user.hasActiveSubscription, onComplete]);

  // Safety: if the merchant opens the Razorpay tab and never completes
  // payment (or closes it), un-stick the buttons after 30s so they can
  // retry without reloading the wizard.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => {
      if (!user.hasActiveSubscription) setPending(null);
    }, 30_000);
    return () => clearTimeout(t);
  }, [pending, user.hasActiveSubscription]);

  const handlePay = useCallback(async () => {
    console.log('[StepLoyaltyAddon] Pay button clicked, choice:', confirm);
    if (!confirm) return;
    const withLoyalty = confirm === 'with_loyalty';
    if (!tierKey || !user.id) {
      setError('Missing subscription details. Go back and re-pick a plan.');
      return;
    }
    setError(null);
    setConfirm(null);
    setPending(withLoyalty ? 'with_loyalty' : 'without_loyalty');
    try {
      await razorpayCheckoutService.openCheckout({
        tierKey,
        merchantId: user.id,
        withLoyalty,
      });
    } catch (err) {
      console.error('[StepLoyaltyAddon] Razorpay open failed:', err);
      setError(err instanceof Error ? err.message : 'Could not open the payment page. Please try again.');
      setPending(null);
    }
  }, [confirm, tierKey, user.id]);

  const tierTotal = subscriptionFee;
  const bundledTotal = subscriptionFee + LOYALTY_ADDON_PRICE;
  const confirmTotal = confirm === 'with_loyalty' ? bundledTotal : tierTotal;
  const confirmWithLoyalty = confirm === 'with_loyalty';

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
            Optional add-on — become a redemption partner
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

      {/* Pricing breakdown */}
      <div style={floatIn(300, visible)} className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your subscription</span>
          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{subscriptionFee}/month</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Loyalty add-on (if chosen)</span>
          <span className="text-sm font-medium text-purple-500">+ ₹{LOYALTY_ADDON_PRICE}/month</span>
        </div>
      </div>

      {error && (
        <div className={`p-3 rounded-xl text-sm text-center mb-3 ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
          {error}
        </div>
      )}

      {/* Main actions — open the confirmation popup. */}
      <div style={floatIn(400, visible)} className="mt-auto pb-safe-bottom pt-2 space-y-3">
        <button
          onClick={() => setConfirm('with_loyalty')}
          disabled={pending !== null}
          className="w-full h-14 rounded-xl bg-purple-600 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-md shadow-purple-500/30"
        >
          {pending === 'with_loyalty' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Add loyalty &amp; pay ₹{bundledTotal}/month
            </>
          )}
        </button>
        <button
          onClick={() => setConfirm('without_loyalty')}
          disabled={pending !== null}
          className={`w-full h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2 ${
            isDark ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white text-slate-900 border border-slate-300'
          }`}
        >
          {pending === 'without_loyalty' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Continue without loyalty — pay ₹{tierTotal}/month
            </>
          )}
        </button>
      </div>

      {/* Confirmation popup — only the button INSIDE this opens vedicjaalam.
          Keeps the click that triggers window.open as a direct user gesture
          (no async state-setting in between), so popup blockers behave. */}
      {confirm && (
        <div className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-6">
          <div className={`w-full max-w-sm p-6 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-white'} relative`}>
            <button
              onClick={() => setConfirm(null)}
              className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'}`}
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <CreditCard className={`w-5 h-5 ${confirmWithLoyalty ? 'text-purple-500' : 'text-slate-500'}`} />
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Confirm payment
              </h3>
            </div>

            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              You&apos;ll be redirected to Razorpay to complete this payment.
            </p>

            {/* Breakdown */}
            <div className={`p-3 rounded-xl mb-5 space-y-2 ${isDark ? 'bg-slate-900/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
              <div className="flex items-center justify-between text-sm">
                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Subscription</span>
                <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{tierTotal}/month</span>
              </div>
              {confirmWithLoyalty && (
                <div className="flex items-center justify-between text-sm">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>Loyalty add-on</span>
                  <span className="font-medium text-purple-500">+ ₹{LOYALTY_ADDON_PRICE}/month</span>
                </div>
              )}
              <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Total</span>
                <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  ₹{confirmTotal}/month
                </span>
              </div>
            </div>

            {/* The single button that actually opens vedicjaalam. Direct user
                gesture — no async state work between this click and window.open. */}
            <button
              onClick={handlePay}
              className="w-full h-12 rounded-xl bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-amber-500/30"
            >
              <CreditCard className="w-4 h-4" />
              Pay with Razorpay (test)
            </button>

            <button
              onClick={() => setConfirm(null)}
              className={`mt-2 w-full h-10 rounded-lg text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
