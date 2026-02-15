
import { supabase } from "./supabaseClient";
import { SubscriptionTier } from "../types";

export const subscriptionService = {
  /**
   * Fetches active subscription tiers from the Supabase Edge Function.
   * This is an authenticated call, so a valid JWT is required.
   */
  getSubscriptionTiers: async (): Promise<SubscriptionTier[]> => {
    console.log("[subscriptionService] Invoking 'get-tiers' Edge Function.");
    try {
      const { data, error } = await supabase.functions.invoke('get-tiers');

      if (error) {
        console.error("[subscriptionService] Edge Function returned error:", error);
        throw error;
      }

      if (!data) {
        console.warn("[subscriptionService] No data received from get-tiers.");
        return [];
      }

      return data as SubscriptionTier[];
    } catch (err: any) {
      console.error("[subscriptionService] Failed to fetch subscription tiers:", err.message || err);
      throw new Error(`Failed to load subscription plans: ${err.message || "Network error"}`);
    }
  },
};