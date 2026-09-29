import { useState, useEffect } from 'react';
import { merchantSubscriptionService } from '../services/merchantSubscriptionService';
import { subscriptionService } from '../services/subscriptionService';

// The Basic / Starter plan does NOT include the product Catalogue feature; every
// other plan does. We identify it by its tier_key FAMILY ('basic_monthly',
// 'basic_yearly', …) rather than a single price — price alone breaks once yearly
// plans exist (₹199 monthly vs ₹1990 yearly would be the same plan). tier_key is
// stable across the DEV/PROD projects (unlike the numeric tier id). Prices are
// kept only as a defensive fallback.
const LOCKED_TIER_PREFIX = 'basic';
const LOCKED_PLAN_FEES = [199, 1990];

/**
 * Returns true when the merchant's ACTIVE plan is the ₹199 tier, so the caller
 * can gray-out / block the Catalogue feature. Re-evaluated on every mount (app
 * load / reload) and whenever the user changes, so a plan upgrade unlocks it
 * without a reinstall. Fails OPEN (returns false) on any error — a transient
 * lookup failure must never wrongly lock a paying merchant out of Catalogue.
 */
export function useCatalogueAccessLocked(
  user: { id: string; role?: string; current_tier_id?: number | null; hasActiveSubscription?: boolean } | null | undefined,
): boolean {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    // Only merchants have a plan; never lock for anyone else.
    if (!user?.id || (user.role && user.role !== 'merchant')) {
      setLocked(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // merchant_subscriptions.plan_name stores the tier_key.
        const { subscription } = await merchantSubscriptionService.fetchCurrentSubscription(user.id);
        const tierKey: string | undefined = subscription?.plan_name;
        if (!tierKey) {
          if (!cancelled) setLocked(false);
          return;
        }
        const tiers = await subscriptionService.getSubscriptionTiers();
        const tier = tiers.find((t) => t.tier_key === tierKey);
        const isBasic = tierKey.startsWith(LOCKED_TIER_PREFIX) || LOCKED_PLAN_FEES.includes(Number(tier?.subscription_fee));
        if (!cancelled) setLocked(isBasic);
      } catch {
        if (!cancelled) setLocked(false); // fail-open
      }
    })();
    return () => { cancelled = true; };
  // current_tier_id / hasActiveSubscription are in the deps so an in-session
  // upgrade re-runs this and unlocks Catalogue the moment payment lands — no reload.
  }, [user?.id, user?.role, user?.current_tier_id, user?.hasActiveSubscription]);

  return locked;
}
