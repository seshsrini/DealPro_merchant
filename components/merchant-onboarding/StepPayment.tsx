import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, Loader2, ShieldCheck, RefreshCw, X } from 'lucide-react';
import { User } from '../../types';
import { razorpayCheckoutService } from '../../services/razorpayCheckoutService';
import { floatIn } from './floatIn';

interface StepPaymentProps {
  user: User;
  subscriptionFee: number;
  tierKey: string | null;
  onComplete: () => void;
  theme: 'light' | 'dark';
}

// Subscription payment step. The merchant picked a tier on StepSubscription;
// here they review the recurring amount and tap "Pay with Razorpay" to hand off
// to VedicJaalam's /subscribe page (Play-compliant web checkout). After the
// first charge succeeds, App.tsx's activation polling flips
// user.hasActiveSubscription and the useEffect below auto-advances to congrats.
export const StepPayment: React.FC<StepPaymentProps> = ({
  user, subscriptionFee, tierKey, onComplete, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Activation succeeded → advance. Not gated on `pending`: the deep link can be
  // blocked and the app may have been backgrounded during payment, so advance
  // whenever the subscription goes active (App.tsx re-checks on resume).
  useEffect(() => {
    if (!user.hasActiveSubscription) return;
    setPending(false);
    onComplete();
  }, [user.hasActiveSubscription, onComplete]);

  // Safety: if the merchant opens the Razorpay tab and never completes payment
  // (or closes it), un-stick the button after 30s so they can retry without
  // reloading the wizard.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => {
      if (!user.hasActiveSubscription) setPending(false);
    }, 30_000);
    return () => clearTimeout(t);
  }, [pending, user.hasActiveSubscription]);

  const handlePay = useCallback(async () => {
    if (!tierKey || !user.id) {
      setError('Missing subscription details. Go back and re-pick a plan.');
      return;
    }
    setError(null);
    setConfirm(false);
    setPending(true);
    try {
      await razorpayCheckoutService.openCheckout({ tierKey, merchantId: user.id });
    } catch (err) {
      console.error('[StepPayment] Razorpay open failed:', err);
      setError(err instanceof Error ? err.message : 'Could not open the payment page. Please try again.');
      setPending(false);
    }
  }, [tierKey, user.id]);

  return (
    <div className="flex flex-col min-h-full px-6 pt-5">
      {/* Header */}
      <div style={floatIn(0, visible)} className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-emerald-500" />
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Activate your subscription
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            One last step to start reaching customers
          </p>
        </div>
      </div>

      {/* Amount summary */}
      <div style={floatIn(100, visible)} className={`p-5 rounded-xl mb-4 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
        <div className="flex items-baseline justify-between">
          <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your plan</span>
          <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ₹{subscriptionFee}
            <span className={`text-sm font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/month</span>
          </span>
        </div>
        <div className={`mt-3 pt-3 border-t text-xs leading-relaxed ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
          You&apos;ll be charged ₹{subscriptionFee} today and automatically every month via Autopay until you cancel or change your plan.
        </div>
      </div>

      {/* Trust row */}
      <div style={floatIn(200, visible)} className={`flex items-center gap-2 mb-4 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
        <span>Secure payment powered by Razorpay · cancel anytime from your subscription settings.</span>
      </div>

      {error && (
        <div className={`p-3 rounded-xl text-sm text-center mb-3 ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
          {error}
        </div>
      )}

      {/* Main action — opens the confirmation popup. */}
      <div style={floatIn(300, visible)} className="mt-auto pb-safe-bottom pt-2">
        <button
          onClick={() => setConfirm(true)}
          disabled={pending}
          className="w-full h-14 rounded-xl bg-emerald-600 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-md shadow-emerald-500/30"
        >
          {pending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Pay ₹{subscriptionFee}/month
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
              onClick={() => setConfirm(false)}
              className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'}`}
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Confirm payment
              </h3>
            </div>

            <p className={`text-sm mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              You&apos;ll be redirected to Razorpay to set up Autopay and complete the first charge.
            </p>

            <div className={`p-3 rounded-xl mb-5 ${isDark ? 'bg-slate-900/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
              <div className="flex items-center justify-between text-sm">
                <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Total today</span>
                <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  ₹{subscriptionFee}/month
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
              Pay with Razorpay
            </button>

            <button
              onClick={() => setConfirm(false)}
              className={`mt-2 w-full h-10 rounded-lg text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Retry hint while a payment is in flight. */}
      {pending && (
        <button
          onClick={() => setPending(false)}
          className={`mt-3 mb-2 mx-auto flex items-center gap-1.5 text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Didn&apos;t complete? Tap to retry
        </button>
      )}
    </div>
  );
};
