
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AppView,
  SubscriptionTier,
  User
} from './types';
import { subscriptionService } from './services/subscriptionService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { razorpayCheckoutService, isPaymentPending, clearPaymentPending } from './services/razorpayCheckoutService';
import { supabase } from './services/supabaseClient';
import { resilient, peekCache } from './services/resilientData';
import { useResumeRefetch } from './services/useResumeRefetch';
import { toMerchantMessage } from './services/friendlyError';
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
  Shield,
} from 'lucide-react';

interface MerchantSubscriptionsProps {
  user: User;
  setView: (view: AppView) => void;
  setUser: (user: User) => void;
  theme?: 'light' | 'dark';
}

export const MerchantSubscriptions: React.FC<MerchantSubscriptionsProps> = ({ user, setView, setUser, theme = 'dark' }) => {
  const { t, locale } = useTranslation();
  const isDark = theme === 'dark';

  // Build a localized "can't cancel" message from the guard code + params. The
  // EF returns a grammatical English `message`; for other languages we fill the
  // translated template's {count}/{date} placeholders.
  const cancelBlockMessage = (info: { error?: string; activeDeals?: number; lockedUntil?: string; message?: string }): string => {
    if (info.error === 'active_deals') {
      if (locale === 'en' && info.message) return info.message;
      return t('m_cancel_blocked_deals').replace('{count}', String(info.activeDeals ?? 1));
    }
    if (info.error === 'locked') {
      if (locale === 'en' && info.message) return info.message;
      const date = info.lockedUntil
        ? new Date(info.lockedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
      return t('m_cancel_blocked_locked').replace('{date}', date);
    }
    return info.message || t('m_cancel_blocked_generic');
  };
  // Cache key for the current-subscription lookup so a cold resume can paint the
  // current plan instantly (stale-while-revalidate).
  const subCacheKey = `sub_current_${user.id}`;
  const cachedSub = peekCache<{ tier_id: number | null; subscription: any }>(subCacheKey);
  // Seed from the last cached tiers / subscription so the screen renders
  // immediately on a cold resume instead of showing a 10s "Loading plans…" wall.
  const [tiers, setTiers] = useState<SubscriptionTier[]>(() => subscriptionService.peekCachedTiers() || []);
  const [loading, setLoading] = useState(() => (subscriptionService.peekCachedTiers()?.length ?? 0) === 0);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tierToConfirm, setTierToConfirm] = useState<SubscriptionTier | null>(null);
  const [currentTierId, setCurrentTierId] = useState<number | null>(cachedSub?.tier_id ?? null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(cachedSub?.subscription ?? null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [checkingCancel, setCheckingCancel] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');

  // A plan change opens an EXTERNAL web checkout; if the merchant abandons it the
  // plan never changes. We record the target tier when the checkout opens and, on
  // return, decide success vs "didn't complete" by whether the subscription
  // actually became that tier — the authoritative completion signal (the app
  // never receives the Razorpay confirmation id of an abandoned web checkout).
  const [incompleteChange, setIncompleteChange] = useState<{ tierKey: string; tierName: string } | null>(null);
  const PENDING_CHANGE_KEY = `dealpro_pending_change_${user.id}`;
  const PENDING_CHANGE_TTL_MS = 30 * 60 * 1000;
  const writePendingChange = (tierKey: string, tierName: string) => {
    try { localStorage.setItem(PENDING_CHANGE_KEY, JSON.stringify({ tierKey, tierName, startedAt: Date.now() })); } catch { /* ignore */ }
  };
  const readPendingChange = (): { tierKey: string; tierName: string; startedAt: number } | null => {
    try { const r = localStorage.getItem(PENDING_CHANGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  };
  const clearPendingChange = () => { try { localStorage.removeItem(PENDING_CHANGE_KEY); } catch { /* ignore */ } };

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

  // Plan-change lock: after an upgrade/downgrade the merchant can't change again
  // until this date (≥ 1 billing month). Also surface a parked (downgrade) change.
  const lockedUntilDate = currentSubscription?.tier_change_locked_until
    ? new Date(currentSubscription.tier_change_locked_until)
    : null;
  const isPlanChangeLocked = !!(lockedUntilDate && lockedUntilDate > new Date());
  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const pendingPlanName = currentSubscription?.pending_plan_name || null;
  const pendingEffectiveDate = currentSubscription?.pending_effective_date
    ? new Date(currentSubscription.pending_effective_date)
    : null;

  // Legacy billing migration (P3): an active subscriber NOT on a Razorpay-native
  // subscription (old token mandate or Google Play trial). Nudge them to set up
  // Razorpay Autopay so renewals are handled natively. Test subs + those already
  // cancelling are excluded.
  const isLegacyBilling = currentSubscription?.status === 'active'
    && !currentSubscription?.razorpay_subscription_id
    && !currentSubscription?.is_test_subscription
    && !currentSubscription?.cancel_at_period_end;

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    // Only show the full-screen spinner on a true first load (no cached tiers).
    // On a resume we already have cached tiers painted, so refresh silently.
    const haveCachedTiers = (subscriptionService.peekCachedTiers()?.length ?? 0) > 0;
    if (!haveCachedTiers) setLoading(true);
    setError(null);
    // Tiers are the essential "Choose a Plan" data (resilient: retries + cache).
    try {
      const fetchedTiers = await subscriptionService.getSubscriptionTiers();
      setTiers(fetchedTiers);
    } catch (err: any) {
      console.error('[MerchantSubscriptions] Tier fetch error:', err);
      // Only surface the error wall if we have nothing cached to show.
      if (!haveCachedTiers) {
        setError(toMerchantMessage(err, { action: 'load your plans', tag: '[Subscriptions]' }));
        setLoading(false);
        return;
      }
    }
    // Current subscription only drives current-plan highlighting — its failure
    // must NOT blank the plan list, so it's best-effort and non-blocking. Wrapped
    // in resilient() so a resume blip falls back to the cached plan instead of
    // dropping the "current plan" badge.
    try {
      const { tier_id, subscription } = await resilient(
        () => merchantSubscriptionService.fetchCurrentSubscription(user.id),
        { cacheKey: subCacheKey, skipCacheIfEmpty: false },
      );
      setCurrentTierId(tier_id);
      setCurrentSubscription(subscription);
    } catch (err) {
      console.warn('[MerchantSubscriptions] Current-subscription fetch failed (non-blocking):', err);
    }
    setLoading(false);
  }, [user.id, subCacheKey]);

  useEffect(() => {
    if (user.isLoggedIn && user.role === 'merchant') {
      fetchData();
    } else {
      setError('Unauthorized access. Please log in as a merchant.');
      setLoading(false);
    }
  }, [user.isLoggedIn, user.role, fetchData]);

  // Silently refresh tiers + current plan when the app returns to the foreground
  // after a long background, so the data is current without ever blanking.
  useResumeRefetch(useCallback(() => {
    if (user.isLoggedIn && user.role === 'merchant') fetchData();
  }, [user.isLoggedIn, user.role, fetchData]));

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

  // ── Reconcile a tracked plan-change checkout (success vs "didn't complete") ──
  // Runs whenever the current subscription updates (mount, return-from-checkout,
  // realtime). If the plan became the target tier → completed, clear the markers.
  // If the attempt is still fresh and the plan hasn't changed → show the banner.
  // Self-corrects: a late-landing change (via realtime) flips the banner to done.
  useEffect(() => {
    const pc = readPendingChange();
    if (!pc) { setIncompleteChange(null); return; }
    const onTarget = currentSubscription?.plan_name === pc.tierKey
      && currentSubscription?.status === 'active'
      && !!currentSubscription?.razorpay_subscription_id;
    if (onTarget || Date.now() - pc.startedAt > PENDING_CHANGE_TTL_MS) {
      clearPaymentPending();
      clearPendingChange();
      setIncompleteChange(null);
    } else {
      setIncompleteChange({ tierKey: pc.tierKey, tierName: pc.tierName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSubscription]);

  // ── Refresh on return from the web checkout ──
  // The Autopay/plan payment completes in an external browser; coming back fires
  // an app resume (native) / postMessage (web) / CustomEvent (legacy). Realtime
  // alone is unreliable (table may not be in the publication), so re-fetch here.
  // If a payment was pending and we're now on a native (Autopay) subscription,
  // confirm it and tell the merchant how billing works going forward.
  useEffect(() => {
    if (!user.id) return;
    const refreshAfterPayment = async () => {
      const wasPending = isPaymentPending();
      const pc = readPendingChange();
      const { tier_id, subscription } = await merchantSubscriptionService.fetchCurrentSubscription(user.id);
      setCurrentTierId(tier_id);
      setCurrentSubscription(subscription); // the reconcile effect updates the "didn't complete" banner
      const active = subscription?.status === 'active' && !!subscription?.razorpay_subscription_id;
      const next = subscription?.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
      if (pc) {
        // A tracked plan change: only a SUCCESS if the plan is now the target
        // tier. If it isn't, the merchant didn't finish the checkout — the
        // reconcile effect shows the "didn't complete" banner (no false success).
        if (subscription?.plan_name === pc.tierKey && active) {
          const planName = subscription?.tier_name || subscription?.plan_name || pc.tierName;
          setNoticeTone('success');
          setNoticeMsg(t('m_autopay_set').replace('{plan}', planName).replace('{date}', next));
        }
        return;
      }
      // New subscription / legacy-Autopay migration (no tracked change) — unchanged.
      if (wasPending && subscription?.razorpay_subscription_id) {
        clearPaymentPending();
        const planName = subscription.tier_name || subscription.plan_name || 'plan';
        setNoticeTone('success');
        setNoticeMsg(t('m_autopay_set').replace('{plan}', planName).replace('{date}', next));
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible' && isPaymentPending()) refreshAfterPayment(); };
    const onPaid = () => refreshAfterPayment();
    const onMessage = (e: MessageEvent) => { if ((e?.data as any)?.type === 'dealpro:paid') refreshAfterPayment(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('dealpro:paid', onPaid as EventListener);
    window.addEventListener('message', onMessage);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('dealpro:paid', onPaid as EventListener);
      window.removeEventListener('message', onMessage);
    };
  }, [user.id]);

  const handleShowConfirmation = (tier: SubscriptionTier) => {
    setTierToConfirm(tier);
    setShowConfirmation(true);
    setError(null);
  };

  // Cancel link → check the guards (active deals / plan-change lock) first.
  // Blocked → show the reason; otherwise open the cancel reason modal.
  const handleCancelClick = async () => {
    setNoticeMsg(null);
    setError(null);
    setCheckingCancel(true);
    const res = await merchantSubscriptionService.checkCancelEligibility(user.id);
    setCheckingCancel(false);
    if (res.allowed) {
      setCancelReason('');
      setShowCancelModal(true);
    } else {
      setNoticeTone('error');
      setNoticeMsg(cancelBlockMessage(res));
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setTierToConfirm(null);
  };

  // Opens Razorpay Checkout in-app via services/razorpayCheckoutService. That
  // service calls Supabase Edge Functions `create-subscription` and
  // `verify-subscription`, then dispatches a 'dealpro:paid' CustomEvent which
  // App.tsx listens to and starts polling merchant_subscriptions for active.
  const handlePayWithRazorpay = async () => {
    if (!tierToConfirm || !user.id) return;
    setShowConfirmation(false);
    setNoticeMsg(null);

    // Already-active merchant changing plan → drive it through Razorpay via the
    // change_tier action (upgrade charges now + instant benefit; downgrade applies
    // next cycle; frequency switch returns resubscribe → web checkout). New/expired
    // merchant → register a fresh subscription via the web checkout.
    const hasActive = currentSubscription?.status === 'active';
    if (hasActive && tierToConfirm.id !== currentTierId) {
      try {
        const res = await merchantSubscriptionService.changeTier(tierToConfirm.tier_key);
        if ((res as any).resubscribe) {
          // Upgrade (Model B) or frequency switch — Razorpay can't change the plan
          // in place, so set up a fresh subscription via web checkout. Record the
          // target tier so that, on return, we can tell the merchant whether the
          // payment completed (the plan became this tier) or was abandoned.
          writePendingChange((res as any).tier_key || tierToConfirm.tier_key, (res as any).tier_name || tierToConfirm.tier_name);
          await razorpayCheckoutService.openCheckout({
            tierKey: (res as any).tier_key || tierToConfirm.tier_key,
            merchantId: user.id,
          });
        } else if (res.success) {
          // Instant upgrade or parked downgrade. English uses the server's
          // grammatical message; other locales fill the translated template.
          setNoticeTone('success');
          if (locale === 'en' && res.message) {
            setNoticeMsg(res.message);
          } else if ((res as any).upgraded) {
            setNoticeMsg(t('m_change_upgraded')
              .replace('{plan}', tierToConfirm.tier_name)
              .replace('{amount}', String((res as any).new_amount ?? tierToConfirm.subscription_fee)));
          } else {
            setNoticeMsg(t('m_change_downgraded').replace('{plan}', tierToConfirm.tier_name));
          }
          await fetchData();
        } else if ((res as any).error === 'locked') {
          // Within the change-lock window — a block, so show it in red.
          setNoticeTone('error');
          if (locale === 'en' && res.message) {
            setNoticeMsg(res.message);
          } else {
            const d = (res as any).locked_until
              ? new Date((res as any).locked_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : '';
            setNoticeMsg(t('m_change_locked').replace('{date}', d));
          }
          await fetchData();
        } else {
          // Show the real server/Razorpay reason so the failure is diagnosable
          // (e.g. "That plan isn't available…", a Razorpay auth message) instead
          // of a generic "couldn't change plan".
          setNoticeTone('error');
          setNoticeMsg(res.error || 'Unable to change plan. Please try again.');
        }
      } catch (err) {
        console.error('[MerchantSubscriptions] change_tier failed:', err);
        setError(toMerchantMessage(err, { action: 'change your plan', tag: '[Subscriptions]' }));
      }
      return;
    }

    try {
      // New / expired subscriber path — App.tsx's activation poll handles the
      // "stuck"/not-completed case for these (it's gated on !hasActiveSubscription),
      // so we don't set the change marker here to avoid a double message. The
      // marker is only for an already-active merchant upgrading (resubscribe above).
      await razorpayCheckoutService.openCheckout({
        tierKey: tierToConfirm.tier_key,
        merchantId: user.id,
      });
    } catch (err) {
      console.error('[MerchantSubscriptions] Razorpay checkout open failed:', err);
      setError(toMerchantMessage(err, { action: 'open the payment page', tag: '[Subscriptions]' }));
    }
  };

  // P3: move a legacy subscriber onto a native Razorpay Autopay subscription.
  // Opens web checkout for their CURRENT tier; verify-subscription writes the
  // native row (razorpay_subscription_id set, no token), after which the custom
  // billing run skips them — so the dormant old mandate is never charged again.
  const handleMigrateToAutopay = async () => {
    const tierKey = currentTier?.tier_key || currentSubscription?.plan_name;
    if (!tierKey || !user.id) {
      setError('Could not determine your plan. Please pick a plan below.');
      return;
    }
    setError(null);
    try {
      await razorpayCheckoutService.openCheckout({ tierKey, merchantId: user.id });
    } catch (err) {
      console.error('[MerchantSubscriptions] Autopay migration checkout failed:', err);
      setError(toMerchantMessage(err, { action: 'open the payment page', tag: '[Subscriptions]' }));
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
          <p className={`text-sm font-medium mt-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_manage_plan')}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
          <CreditCard className="w-5 h-5 text-blue-500" />
        </div>
      </div>

      {/* Plan-change confirmation (instant upgrade / parked downgrade / lock) */}
      {noticeMsg && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          noticeTone === 'error'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {noticeMsg}
        </div>
      )}

      {/* Abandoned-checkout notice: a plan change was started in the web checkout
          but the subscription never became that tier → tell the merchant it didn't
          complete (no charge), with a one-tap retry. */}
      {incompleteChange && (
        <div className={`rounded-xl border px-4 py-3 ${isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Your {incompleteChange.tierName} payment didn&apos;t complete</p>
              <p className="text-xs mt-0.5 opacity-90">No charge was made and your plan is unchanged. You can try again.</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    const tier = tiers.find((tt) => tt.tier_key === incompleteChange.tierKey);
                    clearPendingChange();
                    setIncompleteChange(null);
                    if (tier) handleShowConfirmation(tier);
                  }}
                  className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold active:scale-[0.98]"
                >
                  Try again
                </button>
                <button
                  onClick={() => { clearPendingChange(); setIncompleteChange(null); }}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled (parked) downgrade */}
      {pendingPlanName && pendingEffectiveDate && (
        <div className={`rounded-xl border px-4 py-3 text-xs font-medium ${isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
          Your plan changes to <span className="font-bold">{pendingPlanName}</span> on {fmtDate(pendingEffectiveDate)} — you keep your current plan until then.
        </div>
      )}

      {/* Change-lock notice */}
      {isPlanChangeLocked && lockedUntilDate && (
        <div className={`rounded-xl border px-4 py-3 text-xs font-medium flex items-center gap-2 ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <Clock className="w-4 h-4 shrink-0" />
          {(() => {
            // Use the localized m_change_locked string and bold the date by
            // splitting around its {date} placeholder (present in every language).
            const [before, after] = t('m_change_locked').split('{date}');
            return (
              <span>{before}<span className="font-bold">{fmtDate(lockedUntilDate)}</span>{after}</span>
            );
          })()}
        </div>
      )}

      {/* Legacy → Autopay migration nudge (P3) */}
      {isLegacyBilling && !loading && (
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
                Switch to automatic renewal
              </p>
              <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                Set up Razorpay Autopay so your {currentTier?.tier_name || 'plan'} renews on its own — no manual payments, no interruptions to your deals.
              </p>
              <button
                onClick={handleMigrateToAutopay}
                className="mt-3 h-10 px-4 rounded-xl bg-amber-500 text-white text-xs font-bold flex items-center gap-2 active:scale-[0.98] transition-all shadow-sm shadow-amber-500/30"
              >
                <CreditCard className="w-4 h-4" />
                Set up Autopay
              </button>
            </div>
          </div>
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
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                  {currentTier?.billing_frequency || 'monthly'}
                </p>
              </div>
              {recurringAmount && (
                <div className="text-right">
                  <p className="text-xl font-bold text-emerald-500">
                    ₹{recurringAmount}
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>/month after trial</p>
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
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_days_remaining')}</p>
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
                    <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_next_billing')}</p>
                  </div>
                  <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {trialEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>

            {/* Features row */}
            {currentTier && (
              <div className={`flex items-center gap-4 px-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                <span className="flex items-center gap-1.5 text-xs">
                  <Gauge className="w-3.5 h-3.5 text-blue-400" />
                  {(currentTier.max_campaigns_per_month ?? 0) >= 999 ? 'Unlimited deals' : `${currentTier.max_campaigns_per_month} deals/mo`}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <Tags className="w-3.5 h-3.5 text-amber-400" />
                  {(currentTier.max_dotd_per_month ?? 0) >= 999 ? 'Unlimited DOTD' : `${currentTier.max_dotd_per_month} DOTD/mo`}
                </span>
                {currentTier.is_multi_store && (
                  <span className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Multi-store
                  </span>
                )}
              </div>
            )}

            {/* Cancel link */}
            {!currentSubscription.cancel_at_period_end ? (
              <button
                onClick={handleCancelClick}
                disabled={checkingCancel}
                className={`w-full text-center text-xs underline underline-offset-2 disabled:opacity-50 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}
              >
                {checkingCancel ? 'Checking…' : 'Cancel my subscription'}
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
          <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Loading plans...</p>
        </div>
      ) : error && tiers.length === 0 ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
          <X className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_error_loading')}</p>
          <p className={`text-sm px-10 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{error}</p>
        </div>
      ) : tiers.length === 0 ? (
        <div className={`text-center py-16 rounded-xl border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <Info className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-slate-300' : 'text-slate-900'}`} />
          <p className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('m_no_plans')}</p>
          <p className={`text-sm px-10 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>Please check back later.</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-visible ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          {/* Table Header */}
          <div className={`grid grid-cols-12 gap-3 px-4 py-3 border-b ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="col-span-3">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_plan')}</p>
            </div>
            <div className="col-span-2">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_price')}</p>
            </div>
            <div className="col-span-2">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_deals')}</p>
            </div>
            <div className="col-span-2">
              <p className={`text-[10px] font-medium ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_dotd_short')}</p>
            </div>
            <div className="col-span-3"></div>
          </div>

          {/* Table Rows — monthly plans first, then a Yearly section */}
          {(() => {
            const monthly = tiers.filter((tt) => tt.billing_frequency !== 'yearly');
            const yearly = tiers.filter((tt) => tt.billing_frequency === 'yearly');
            const ordered = [...monthly, ...yearly];
            return ordered.map((tier, index) => (
              <React.Fragment key={tier.id}>
                {yearly.length > 0 && index === monthly.length && (
                  <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'bg-slate-800/40 text-slate-400 border-t border-slate-800' : 'bg-slate-50 text-slate-500 border-t border-slate-200'}`}>
                    Yearly Plans
                  </div>
                )}
                <div
                  className={`grid grid-cols-12 gap-3 px-4 py-4 items-center transition-colors ${
                    index !== ordered.length - 1 ? (isDark ? 'border-b border-slate-800/50' : 'border-b border-slate-100') : ''
                  }`}
                >
              <div className="col-span-3">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tier.tier_name}</p>
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{tier.billing_frequency}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm font-semibold text-emerald-500">
                  {tier.currency} {tier.subscription_fee}
                </p>
              </div>
              {(tier.max_campaigns_per_month ?? 0) >= 999 && (tier.max_dotd_per_month ?? 0) >= 999 ? (
                // Both deals and DOTD are unlimited — show ONE "Unlimited" spanning
                // both columns instead of "UnlimitedUnlimited".
                <div className="col-span-4">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-blue-400" />
                    <Tags className="w-4 h-4 text-amber-400" />
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Unlimited</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-blue-400" />
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {(tier.max_campaigns_per_month ?? 0) >= 999 ? 'Unlimited' : tier.max_campaigns_per_month}
                      </span>
                      {(tier.max_campaigns_per_month ?? 0) < 999 && (
                        <span className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>/mo</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5">
                      <Tags className="w-4 h-4 text-amber-400" />
                      <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {(tier.max_dotd_per_month ?? 0) >= 999 ? 'Unlimited' : tier.max_dotd_per_month}
                      </span>
                      {(tier.max_dotd_per_month ?? 0) < 999 && (
                        <span className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>/mo</span>
                      )}
                    </div>
                  </div>
                </>
              )}
              <div className="col-span-3 flex justify-end">
                {currentTierId === tier.id ? (
                  <span className="px-3 h-8 rounded-lg bg-emerald-500 text-white font-semibold text-[11px] flex items-center">
                    Current
                  </span>
                ) : isPlanChangeLocked ? (
                  <span
                    title={lockedUntilDate ? `You can change plans again after ${fmtDate(lockedUntilDate)}` : undefined}
                    className={`px-3 h-8 rounded-lg font-semibold text-[11px] flex items-center gap-1 ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}
                  >
                    <Clock className="w-3 h-3" /> Locked
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
              </React.Fragment>
            ));
          })()}
        </div>
      )}

      {/* Error banner (non-blocking) */}
      {error && tiers.length > 0 && (
        <div className={`p-3 rounded-xl text-sm text-center ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'}`}>
          {error}
        </div>
      )}

      {/* ═══ Cancel Subscription Modal ═══ */}
      {showCancelModal && createPortal(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className={`max-w-sm w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-4 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
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
              <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
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
                    } else if (result.message || result.error === 'active_deals' || result.error === 'locked') {
                      // Blocked by a guard (live deals running / recent plan-change
                      // lock) — surface the localized reason in red.
                      setShowCancelModal(false);
                      setNoticeTone('error');
                      setNoticeMsg(cancelBlockMessage(result));
                    } else {
                      setError('Unable to cancel subscription. Please try again.');
                      setShowCancelModal(false);
                    }
                  } catch (err) {
                    setError(toMerchantMessage(err, { action: 'cancel your subscription', tag: '[Subscriptions]' }));
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
        </div>,
        document.body
      )}

      {/* ═══ Confirmation Modal ═══ */}
      {showConfirmation && tierToConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className={`max-w-md w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-5 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="text-center">
              <div className={`w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <BadgeDollarSign className="w-7 h-7 text-blue-500" />
              </div>
              <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {currentSubscription?.status === 'active' && tierToConfirm.id !== currentTierId ? 'Confirm Plan Change' : 'Confirm Subscription'}
              </h3>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>
                {currentSubscription?.status === 'active' && tierToConfirm.id !== currentTierId ? "You're about to switch to:" : "You're about to subscribe to:"}
              </p>
            </div>

            <div className={`rounded-xl border p-5 space-y-4 ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_plan')}</p>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tierToConfirm.tier_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_price')}</p>
                  <p className="text-lg font-semibold text-emerald-500">
                    {tierToConfirm.currency} {tierToConfirm.subscription_fee}
                  </p>
                </div>
                <div>
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_billing')}</p>
                  <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tierToConfirm.billing_frequency}</p>
                </div>
              </div>
              <div>
                <p className={`text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>{t('m_features')}</p>
                <ul className={`space-y-1.5 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {(tierToConfirm.max_campaigns_per_month ?? 0) >= 999 ? 'Unlimited deals' : `${tierToConfirm.max_campaigns_per_month} deals per month`}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    {(tierToConfirm.max_dotd_per_month ?? 0) >= 999 ? 'Unlimited Deal-of-Day' : `${tierToConfirm.max_dotd_per_month} deal-of-day per month`}
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

            {/* UPGRADE only: upgrading restarts the billing cycle today (full charge
                now, billing date → today) and resets the deal count to the new
                plan's limits. Not shown for downgrades, which are parked for the
                next cycle and don't reset usage now. */}
            {currentSubscription?.status === 'active' && tierToConfirm.id !== currentTierId
              && tierToConfirm.subscription_fee > (currentTier?.subscription_fee ?? 0) && (
              <div className={`flex gap-2 rounded-xl border p-3 text-xs leading-snug ${
                isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t('m_change_reset_note')}</span>
              </div>
            )}

            {/* Single action — always the Razorpay path: change_tier (in-place
                upgrade/downgrade) for an active subscriber, or web checkout for a
                new subscription. No legacy 'create' bypass that could let an
                upgrade through when the Razorpay step fails. */}
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
                onClick={handlePayWithRazorpay}
                className="flex-1 h-12 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {currentSubscription?.status === 'active' && tierToConfirm.id !== currentTierId
                    ? 'Pay with Autopay'
                    : 'Pay with Razorpay'}
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
