import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, Loader2, CheckCircle2, Gauge, Tags, ShieldCheck, AlertTriangle, FlaskConical } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { SubscriptionTier, User } from '../../types';
import { subscriptionService } from '../../services/subscriptionService';
import { merchantSubscriptionService } from '../../services/merchantSubscriptionService';
import { isReviewerAccount } from '../../services/reviewerAccess';
import { billingService } from '../../services/BillingService';
import { localSubscriptionStore } from '../../services/LocalSubscriptionStore';
import { supabase } from '../../services/supabaseClient';
import { floatIn } from './floatIn';

interface StepSubscriptionProps {
  user: User;
  setUser: (user: User) => void;
  // alreadyActive: true if a subscription was created synchronously here
  // (test bypass / dev trial path). Tells the parent to skip the payment
  // step and jump straight to congrats. Default false → the payment step
  // handles Razorpay.
  onComplete: (subscriptionFee?: number, subscriptionId?: number, tierKey?: string, alreadyActive?: boolean) => void;
  onBack: () => void;
  theme: 'light' | 'dark';
  trialExpired?: boolean; // true when shown because trial period ended
}

export const StepSubscription: React.FC<StepSubscriptionProps> = ({
  user, setUser, onComplete, onBack, theme, trialExpired = false,
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
  const [billingReady, setBillingReady] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  // Test bypass: shown while VITE_ALLOW_TEST_SUBSCRIPTION is true (internal
  // testers) OR when the signed-in account is the designated app-review account
  // (VITE_REVIEWER_PHONES) so the Google Play reviewer can skip payment. Hidden
  // from real merchants; the server enforces the same allow-list.
  const allowTestBypass = String(import.meta.env.VITE_ALLOW_TEST_SUBSCRIPTION || '').toLowerCase() === 'true'
    || isReviewerAccount(user);
  const [testBypassing, setTestBypassing] = useState(false);

  // Advances to the payment step without creating a subscription or charging
  // anything. The Razorpay payment is taken on StepPayment.
  const handleContinueToPayment = useCallback(() => {
    if (!tierToConfirm || !user.id) return;
    setShowConfirm(false);
    setError(null);
    onComplete(tierToConfirm.subscription_fee, undefined, tierToConfirm.tier_key);
  }, [tierToConfirm, user.id, onComplete]);

  const handleTestBypass = useCallback(async () => {
    if (!user.id || testBypassing) return;
    setTestBypassing(true);
    setError(null);
    try {
      const { data, error: efErr } = await supabase.functions.invoke('merchant-subscription', {
        // Uses the dedicated 'pro_test' tier in subscription_tiers
        // (is_active=false so it doesn't appear in the public tier list,
        // limits are 999/999 so the test bypass never bumps into a cap).
        body: { action: 'create_test_subscription', tier_key: 'pro_test' },
      });
      if (efErr || !data?.success) {
        const msg = data?.error || efErr?.message || 'Could not create test subscription.';
        throw new Error(msg);
      }
      setUser({
        ...user,
        hasActiveSubscription: true,
        subscription_status: 'active',
        current_tier_id: data.subscription?.id ?? null,
      });
      onComplete(0, data.subscriptionId, undefined, true);
    } catch (err: any) {
      console.error('[StepSubscription] Test bypass error:', err?.message || err);
      setError(err?.message || 'Test bypass failed.');
      setTestBypassing(false);
    }
  }, [user, testBypassing, setUser, onComplete]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Fetch tiers from Supabase
  useEffect(() => {
    subscriptionService.getSubscriptionTiers()
      .then((data) => setTiers(data))
      .catch(() => setError('Unable to load plans. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  // Initialize Google Play Billing on native
  useEffect(() => {
    if (!isNative) return;
    billingService.setMerchantId(user.id);
    billingService.initialize().then((ok) => {
      setBillingReady(ok);
      if (ok) console.log('[StepSubscription] Google Play Billing initialized');
    });
  }, [isNative, user.id]);

  const handleSelect = (tier: SubscriptionTier) => {
    setTierToConfirm(tier);
    setShowConfirm(true);
    setError(null);
  };

  /**
   * Complete subscription via Google Play Billing (native) or Supabase (web).
   */
  const handleConfirm = useCallback(async () => {
    if (!tierToConfirm || !user.id) return;
    setShowConfirm(false);
    setSelecting(true);
    setSelectedTierId(tierToConfirm.id);
    setError(null);

    // ─── Native: Google Play Billing (temporarily disabled — using web flow for all) ───
    if (false && isNative && billingReady) {
      const productId = billingService.tierKeyToProductId(tierToConfirm.tier_key);
      if (!productId) {
        setError('Plan not available for in-app purchase.');
        setSelecting(false);
        setSelectedTierId(null);
        return;
      }

      // Set the fee so the verified handler can store it
      billingService.setPendingFee(tierToConfirm.subscription_fee);

      // Register callback for when purchase completes
      billingService.onPurchaseCompleted(async (success, planName, purchaseToken) => {
        if (success) {
          // Also create the server-side subscription record
          const result = await merchantSubscriptionService.createSubscription(
            user.id, tierToConfirm.id, tierToConfirm.tier_key, tierToConfirm.tier_name
          );

          setUser({
            ...user,
            hasActiveSubscription: true,
            subscription_status: 'active',
            current_tier_id: tierToConfirm.id,
          });
          onComplete(tierToConfirm.subscription_fee, result.subscriptionId, undefined, true);
        } else {
          setError('Purchase was not completed. Please try again.');
          setSelecting(false);
          setSelectedTierId(null);
        }
      });

      // Launch the Google Play purchase flow (prefers free trial offer)
      const purchaseResult = await billingService.purchase(productId);
      if (!purchaseResult.success) {
        setError(purchaseResult.error || 'Purchase failed. Please try again.');
        setSelecting(false);
        setSelectedTierId(null);
      }
      // If success, the verified handler callback above will fire asynchronously
      return;
    }

    // ─── Web/signup: use create-subscription edge function ───
    try {
      // Try authenticated edge function first (works when session is established)
      let result = await merchantSubscriptionService.createSubscription(
        user.id, tierToConfirm.id, tierToConfirm.tier_key, tierToConfirm.tier_name
      );

      // If it fails (common during signup when JWT isn't ready), use the
      // unauthenticated create-subscription edge function that uses service role
      if (!result.success) {
        console.warn('[StepSubscription] Authenticated EF failed:', result.error, '— using create-subscription fallback');
        const { data, error } = await supabase.functions.invoke('create-subscription', {
          body: {
            merchantId: user.id,
            tier_id: tierToConfirm.id,
            tier_key: tierToConfirm.tier_key,
            tier_name: tierToConfirm.tier_name,
          },
        });

        console.log('[StepSubscription] Fallback response — data:', data, 'error:', error);

        // Handle case where supabase returns error with body in context
        let responseData = data;
        if (error && !responseData) {
          try {
            responseData = await (error as any).context?.json?.();
          } catch {}
        }

        if (!responseData?.success) {
          const errMsg = responseData?.error || error?.message || 'Failed to activate subscription.';
          console.error('[StepSubscription] Fallback EF failed:', errMsg);
          throw new Error(errMsg);
        }
        result = { success: true, isTrialing: responseData.isTrialing, trial_end: responseData.subscription?.trial_end, subscriptionId: responseData.subscriptionId };
      }

      // Save to local IndexedDB for offline access (non-blocking — don't let it break the flow)
      try {
        await localSubscriptionStore.upsert({
          remoteId: result.subscriptionId || null,
          merchantId: user.id,
          planName: tierToConfirm.tier_name,
          status: result.isTrialing ? 'trialing' : 'active',
          purchaseToken: null,
          productId: null,
          trialEnd: result.trial_end || null,
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: null,
          totalRecurringAmount: tierToConfirm.subscription_fee,
        });
      } catch (idbErr) {
        console.warn('[StepSubscription] IndexedDB save failed (non-blocking):', idbErr);
      }

      setUser({
        ...user,
        hasActiveSubscription: true,
        subscription_status: result.isTrialing ? 'trialing' : 'active',
        current_tier_id: tierToConfirm.id,
      });
      onComplete(tierToConfirm.subscription_fee, result.subscriptionId, undefined, true);
    } catch (err: any) {
      console.error('[StepSubscription] Subscription error:', err.message);

      // Last resort: check if a subscription was actually created despite the error
      try {
        const { data: existingSub } = await supabase
          .from('merchant_subscriptions')
          .select('id, status, trial_end')
          .eq('merchant_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSub) {
          console.log('[StepSubscription] Subscription exists in DB despite error — proceeding');
          setUser({
            ...user,
            hasActiveSubscription: true,
            subscription_status: 'active',
            current_tier_id: tierToConfirm.id,
          });
          onComplete(tierToConfirm.subscription_fee, existingSub.id, undefined, true);
          return;
        }
      } catch {}

      setError('Unable to activate subscription. Please try again.');
      setSelecting(false);
      setSelectedTierId(null);
    }
  }, [tierToConfirm, user, isNative, billingReady, setUser, onComplete]);

  return (
    <div className="flex flex-col min-h-full px-6 pt-5">
      <div style={floatIn(0, visible)} className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${trialExpired ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
          {trialExpired ? <AlertTriangle className="w-6 h-6 text-amber-500" /> : <CreditCard className="w-6 h-6 text-emerald-500" />}
        </div>
        <div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {trialExpired ? 'Trial period ended' : 'Choose your plan'}
          </h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {trialExpired ? 'Select a plan to continue using DealPro' : 'Select a subscription to get started'}
          </p>
        </div>
      </div>

      {/* Trial banner */}
      {trialExpired ? (
        <div style={floatIn(50, visible)} className={`p-3.5 rounded-xl mb-4 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
            Your free trial has ended. To continue creating deals, managing your store, and reaching customers, please select a paid plan below.
          </p>
        </div>
      ) : (
        <div style={floatIn(50, visible)} className={`p-3.5 rounded-xl mb-4 flex items-start gap-2.5 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
          <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className={`text-xs font-semibold mb-0.5 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
              Start today
            </p>
            <p className={`text-[11px] leading-relaxed ${isDark ? 'text-emerald-400/80' : 'text-emerald-600'}`}>
              You&apos;ll be charged the plan amount today and automatically each cycle. Cancel or change anytime.
            </p>
          </div>
        </div>
      )}

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
                .catch(() => setError('Unable to load plans. Please try again.'))
                .finally(() => setLoading(false));
            }}
            className="h-12 px-6 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3 pb-4">
          {error && (
            <div className={`p-3 rounded-xl text-sm text-center ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
              {error}
            </div>
          )}
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
                  <Gauge className="w-3.5 h-3.5" /> {(tier.max_campaigns_per_month ?? 0) >= 999 ? 'Unlimited deals' : `${tier.max_campaigns_per_month} deals/mo`}
                </span>
                <span className="flex items-center gap-1">
                  <Tags className="w-3.5 h-3.5" /> {(tier.max_dotd_per_month ?? 0) >= 999 ? 'Unlimited DOTD' : `${tier.max_dotd_per_month} DOTD/mo`}
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
            <p className={`text-sm mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              You're selecting <strong>{tierToConfirm.tier_name}</strong> at{' '}
              <strong>{tierToConfirm.currency}{tierToConfirm.subscription_fee}/{tierToConfirm.billing_frequency}</strong>
            </p>
            {!trialExpired && (
              <p className={`text-xs mb-3 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                You&apos;ll be charged {tierToConfirm.currency}{tierToConfirm.subscription_fee} today, then automatically each {tierToConfirm.billing_frequency} until you cancel.
              </p>
            )}
            <div className={`space-y-2 mb-6 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {(tierToConfirm.max_campaigns_per_month ?? 0) >= 999 ? 'Unlimited deals' : `${tierToConfirm.max_campaigns_per_month} deals per month`}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                {(tierToConfirm.max_dotd_per_month ?? 0) >= 999 ? 'Unlimited Deal-of-Day' : `${tierToConfirm.max_dotd_per_month} deal-of-day per month`}
              </div>
              {tierToConfirm.is_multi_store && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Multi-store support
                </div>
              )}
            </div>
            {/* Primary action: advance to the payment step, where the Razorpay
                charge for this tier is taken. */}
            <button
              onClick={handleContinueToPayment}
              className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              Continue
            </button>

            {/* Legacy 120-day-trial path — left intact behind the dev-only
                test bypass flag (allowTestBypass = VITE_ALLOW_TEST_SUBSCRIPTION).
                Hidden in normal production builds. */}
            {allowTestBypass && (
              <button
                onClick={handleConfirm}
                className={`mt-2 w-full h-10 rounded-lg text-xs font-medium underline-offset-2 hover:underline ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                [Dev] Activate test subscription without payment
              </button>
            )}

            <button
              onClick={() => setShowConfirm(false)}
              className={`mt-1 w-full h-10 rounded-lg text-xs font-medium ${
                isDark ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Test-only bypass — visible while VITE_ALLOW_TEST_SUBSCRIPTION=true. */}
      {allowTestBypass && (
        <div style={floatIn(550, visible)} className="mt-4 mb-2">
          <div className={`rounded-xl border-2 border-dashed p-3 ${isDark ? 'border-amber-500/40 bg-amber-500/5' : 'border-amber-400 bg-amber-50'}`}>
            <div className="flex items-start gap-2 mb-2">
              <FlaskConical className={`w-4 h-4 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-700'}`} />
              <div>
                <p className={`text-xs font-bold ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>Test Mode Only — Will Be Removed</p>
                <p className={`text-[11px] ${isDark ? 'text-amber-400/80' : 'text-amber-700/80'}`}>
                  Skip payment for internal testing. Creates a 30-day test subscription.
                </p>
              </div>
            </div>
            <button
              onClick={handleTestBypass}
              disabled={testBypassing || selecting}
              className={`w-full h-11 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30' : 'bg-amber-500 text-white border border-amber-600'
              }`}
            >
              {testBypassing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
              {testBypassing ? 'Creating test subscription…' : 'Skip Payment (Test Subscription)'}
            </button>
          </div>
        </div>
      )}

      {!trialExpired && (
        <div style={floatIn(600, visible)} className="mt-auto pb-safe-bottom pt-4">
          <button
            onClick={onBack}
            className={`w-full h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
};
