
import { supabase } from "./supabaseClient";
import { SubscriptionTier } from "../types";

// Subscription tiers change rarely, so we cache the last good result. A transient
// failure (cold start, network blip, brief 5xx, a token refresh mid-call) then
// falls back to cached plans instead of dropping the merchant to a hard
// "Error Loading Plans" wall.
const TIERS_CACHE_KEY = "merchant_subscription_tiers_v1";
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function readCachedTiers(): SubscriptionTier[] | null {
  try {
    const raw = localStorage.getItem(TIERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.tiers) && parsed.tiers.length > 0) {
      return parsed.tiers as SubscriptionTier[];
    }
  } catch { /* ignore corrupt cache */ }
  return null;
}

function writeCachedTiers(tiers: SubscriptionTier[]): void {
  try {
    if (Array.isArray(tiers) && tiers.length > 0) {
      localStorage.setItem(TIERS_CACHE_KEY, JSON.stringify({ tiers, at: Date.now() }));
    }
  } catch { /* quota / disabled storage — ignore */ }
}

export const subscriptionService = {
  /**
   * Fetches active subscription tiers from the 'get-tiers' Edge Function.
   * Resilient: retries transient failures with backoff, caches the last good
   * result, and falls back to that cache rather than erroring on a blip. Only
   * throws if every attempt fails AND we have never cached tiers.
   */
  getSubscriptionTiers: async (): Promise<SubscriptionTier[]> => {
    let lastErr: any = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke("get-tiers");
        if (error) throw error;

        const tiers = (data || []) as SubscriptionTier[];
        // Only cache a non-empty result so an empty blip can't poison the cache.
        if (tiers.length > 0) writeCachedTiers(tiers);
        if (attempt > 1) console.log(`[subscriptionService] get-tiers recovered on attempt ${attempt}.`);
        return tiers;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[subscriptionService] get-tiers attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err?.message || err);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 150);
        }
      }
    }

    // Every attempt failed — serve cached plans if we have them, so a momentary
    // outage doesn't hard-block the screen.
    const cached = readCachedTiers();
    if (cached) {
      console.warn("[subscriptionService] Serving cached subscription tiers after fetch failure.");
      return cached;
    }

    console.error("[subscriptionService] Failed to fetch subscription tiers and no cache available:", lastErr?.message || lastErr);
    throw new Error(`Failed to load subscription plans: ${lastErr?.message || "Network error"}`);
  },
};
