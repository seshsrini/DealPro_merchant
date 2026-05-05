

import { supabase } from "./supabaseClient";
import { loadCachedClicks, saveCachedClicks, loadCachedRedemptions, saveCachedRedemptions, makeKey } from "./campaignClicksCache";
import { loadCachedCounter, saveCachedCounter } from "./dashboardCountersCache";

/**
 * Generic helper: SWR-style fetch for a single dashboard counter.
 *   - fresh cache (< 5 min)              → return cached
 *   - stale or missing cache             → fetch fresh, save, return
 *   - network/auth error + cached value  → return stale cache (graceful degrade)
 *   - error + no cache                   → throw user-facing message
 */
async function cachedCounterFetch<T extends { count: number }>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  errorMsg = 'Unable to load dashboard data. Please try again.',
): Promise<T> {
  const cached = loadCachedCounter<T>(cacheKey);
  if (cached?.isFresh) return cached.value;
  try {
    const fresh = await fetcher();
    saveCachedCounter(cacheKey, fresh);
    return fresh;
  } catch (err: any) {
    console.warn(`[mDashboardService] counter fetch failed for ${cacheKey}:`, err?.message || err);
    if (cached) return cached.value;
    throw new Error(errorMsg);
  }
}

// Module-level guard: collapse concurrent identical requests into one in-flight fetch.
const _inflightClicksByKey = new Map<string, Promise<{ views: Record<string, number>; claimClicks: Record<string, number> }>>();
const _inflightRedemptionsByKey = new Map<string, Promise<Record<string, number>>>();

export const mDashboardService = {
  // Calls Edge Function
  getMerchantDashboardMetrics: async (merchantId: string, activeRoiTab: 'review' | 'active' | 'expired' = 'active') => {
    console.log(`[mDashboardService] Calling Edge Function for merchant dashboard metrics for ${merchantId} with tab ${activeRoiTab}`);
    const { data, error } = await supabase.functions.invoke('get-metrics', { // Changed to 'get-metrics'
      body: { merchantId, activeRoiTab },
    });
    if (error) {
      console.error("[mDashboardService] Failed to fetch merchant dashboard metrics via Edge Function:", error);
      throw new Error('Unable to load dashboard data. Please try again.');
    }
    return data;
  },

  /**
   * Fetches views + claim clicks for a specific set of campaign IDs.
   * Returns { views: Record<id, count>, claimClicks: Record<id, count> }.
   *
   * Cached in localStorage with a 30-second freshness window:
   *   - Fresh cache: return immediately, no network.
   *   - Stale or missing: fetch fresh, save, return.
   *   - On auth/network error: fall back to cached value if any so the dashboard
   *     stays populated even when the JWT is briefly rejected or we're offline.
   *   - In-flight requests for the same id-set are coalesced.
   */
  getCampaignSpecificClicks: async (campaignIds: string[]): Promise<{
    views: Record<string, number>;
    claimClicks: Record<string, number>;
  }> => {
    if (campaignIds.length === 0) return { views: {}, claimClicks: {} };

    const cached = loadCachedClicks(campaignIds);
    if (cached?.isFresh) {
      console.log(`[mDashboardService] Returning fresh cached clicks (age ${Math.round(cached.ageMs / 1000)}s)`);
      return cached.payload;
    }

    const key = makeKey(campaignIds);
    const inflight = _inflightClicksByKey.get(key);
    if (inflight) return inflight;

    const fetchPromise = (async () => {
      console.log(`[mDashboardService] Calling Edge Function for campaign specific clicks (${campaignIds.length} ids)`);
      try {
        const { data, error } = await supabase.functions.invoke('get-campaign-specific-clicks', {
          body: { campaignIds },
        });
        if (error) throw error;
        // Normalize: new shape `{ views, claimClicks }`, legacy shape was a flat map.
        const payload = data?.views
          ? { views: data.views as Record<string, number>, claimClicks: (data.claimClicks || {}) as Record<string, number> }
          : { views: data as Record<string, number>, claimClicks: {} as Record<string, number> };
        saveCachedClicks(campaignIds, payload);
        return payload;
      } catch (err: any) {
        console.warn('[mDashboardService] get-campaign-specific-clicks failed:', err?.message || err);
        if (cached) {
          console.log(`[mDashboardService] Falling back to stale cached clicks (age ${Math.round(cached.ageMs / 1000)}s)`);
          return cached.payload;
        }
        throw new Error('Unable to load dashboard data. Please try again.');
      } finally {
        _inflightClicksByKey.delete(key);
      }
    })();

    _inflightClicksByKey.set(key, fetchPromise);
    return fetchPromise;
  },

  /**
   * Fetches redemption counts for a specific set of campaign IDs for a merchant.
   * Redemptions are for campaigns owned by the merchant, marked as `is_redeemed: true`.
   *
   * Cached in localStorage with a 30-second freshness window:
   *   - Fresh cache: return immediately, no network call.
   *   - Stale or missing: fetch fresh, save, return.
   *   - On auth/network error: fall back to last cached value if any so the
   *     dashboard stays populated when the JWT is briefly rejected.
   *   - In-flight requests for the same merchant+id-set are coalesced.
   */
  getCampaignSpecificRedemptions: async (merchantId: string, campaignIds: string[]): Promise<Record<string, number>> => {
    if (campaignIds.length === 0) return {};

    const cached = loadCachedRedemptions(merchantId, campaignIds);
    if (cached?.isFresh) return cached.counts;

    const dedupeKey = `${merchantId}|${makeKey(campaignIds)}`;
    const inflight = _inflightRedemptionsByKey.get(dedupeKey);
    if (inflight) return inflight;

    const fetchPromise = (async () => {
      console.log(`[mDashboardService] Calling Edge Function for campaign specific redemptions (${campaignIds.length} ids)`);
      try {
        const { data, error } = await supabase.functions.invoke('get-campaign-specific-redemptions', {
          body: { merchantId, campaignIds },
        });
        if (error) throw error;
        const counts = (data || {}) as Record<string, number>;
        saveCachedRedemptions(merchantId, campaignIds, counts);
        return counts;
      } catch (err: any) {
        console.warn('[mDashboardService] get-campaign-specific-redemptions failed:', err?.message || err);
        if (cached) return cached.counts;
        throw new Error('Unable to load dashboard data. Please try again.');
      } finally {
        _inflightRedemptionsByKey.delete(dedupeKey);
      }
    })();

    _inflightRedemptionsByKey.set(dedupeKey, fetchPromise);
    return fetchPromise;
  },

  /**
   * Fetches the total lifetime deals for a merchant.
   * 5-min cached, falls back to last cached value on auth/network failure.
   */
  getTotalLifetimeDeals: (merchantId: string): Promise<{ count: number }> =>
    cachedCounterFetch<{ count: number }>(`lifetime-deals:${merchantId}`, async () => {
      const { data, error } = await supabase.functions.invoke('get-total-lifetime-deals', {
        body: { merchantId },
      });
      if (error) throw error;
      return data;
    }),

  /**
   * Fetches the total lifetime clicks for a merchant.
   * 5-min cached, falls back to last cached value on auth/network failure.
   */
  getTotalLifetimeClicks: (merchantId: string): Promise<{ count: number }> =>
    cachedCounterFetch<{ count: number }>(`lifetime-clicks:${merchantId}`, async () => {
      const { data, error } = await supabase.functions.invoke('get-total-lifetime-clicks', {
        body: { merchantId },
      });
      if (error) throw error;
      return data;
    }),

  /**
   * Fetches the total lifetime redemptions for a merchant.
   * 5-min cached, falls back to last cached value on auth/network failure.
   */
  getTotalLifetimeRedemptions: (merchantId: string): Promise<{ count: number }> =>
    cachedCounterFetch<{ count: number }>(`lifetime-redemptions:${merchantId}`, async () => {
      const { data, error } = await supabase.functions.invoke('get-total-lifetime-redemptions', {
        body: { merchantId },
      });
      if (error) throw error;
      return data;
    }),

  getRepeatCustomers: async (merchantId: string) => {
    const { data, error } = await supabase.functions.invoke('get-repeat-customers', {
      body: { merchantId },
    });
    if (error) throw new Error('Unable to load repeat customer data.');
    return data;
  },

  /**
   * Fetches the total number of invites sent by a merchant.
   * 5-min cached, falls back to last cached value on auth/network failure.
   */
  getTotalInvitesSent: (merchantId: string): Promise<{ count: number }> =>
    cachedCounterFetch<{ count: number }>(`invites-sent:${merchantId}`, async () => {
      const { data, error } = await supabase.functions.invoke('get-total-invites-sent', {
        body: { merchantId },
      });
      if (error) throw error;
      return data;
    }),

  /**
   * Fetches the total number of invites accepted for a merchant.
   * 5-min cached, falls back to last cached value on auth/network failure.
   */
  getTotalInvitesAccepted: (merchantId: string): Promise<{ count: number }> =>
    cachedCounterFetch<{ count: number }>(`invites-accepted:${merchantId}`, async () => {
      const { data, error } = await supabase.functions.invoke('get-total-invites-accepted', {
        body: { merchantId },
      });
      if (error) throw error;
      return data;
    }),
};