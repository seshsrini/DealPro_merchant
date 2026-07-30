import { useState, useEffect } from 'react';
import { merchantSubscriptionService } from '../services/merchantSubscriptionService';
import { subscriptionService } from '../services/subscriptionService';

// The Rs.199 (Starter) plan does NOT include the product Catalogue feature; every
// other plan does. We identify that plan by its PRICE from subscription_tiers —
// not the numeric tier id, which differs between the DEV and PROD Supabase
// projects and would risk locking the wrong plan in one environment.
const LOCKED_PLAN_FEE = 199;

/**
 * Returns true when the merchant's ACTIVE plan is the ₹199 tier, so the caller
 * can gray-out / block the Catalogue feature. Re-evaluated on every mount (app
 * load / reload) and whenever the user changes, so a plan upgrade unlocks it
 * without a reinstall. Fails OPEN (returns false) on any error — a transient
 * lookup failure must never wrongly lock a paying merchant out of Catalogue.
 */
export function useCatalogueAccessLocked(
  user: { id: string; role?: string } | null | undefined,
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
        if (!cancelled) setLocked(Number(tier?.subscription_fee) === LOCKED_PLAN_FEE);
      } catch {
        if (!cancelled) setLocked(false); // fail-open
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);

  return locked;
}
