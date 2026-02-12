
import { supabase } from "./supabaseClient";

export const merchantSubscriptionService = {
  /**
   * Check if a merchant has an active subscription
   */
  checkActiveSubscription: async (merchantId: string): Promise<{
    hasActiveSubscription: boolean;
    subscription_status?: string;
    current_tier_id?: number;
  }> => {
    console.log("[merchantSubscriptionService] Checking active subscription for merchant:", merchantId);

    try {
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: { action: 'check' },
      });

      if (error) {
        console.error("[merchantSubscriptionService] Error checking subscription:", error);
        return { hasActiveSubscription: false };
      }

      console.log("[merchantSubscriptionService] Subscription check result:", data);
      return {
        hasActiveSubscription: data?.hasActiveSubscription || false,
        subscription_status: data?.subscription_status,
      };
    } catch (err: any) {
      console.error("[merchantSubscriptionService] Exception checking subscription:", err.message);
      return { hasActiveSubscription: false };
    }
  },

  /**
   * Fetch current active subscription for a merchant
   */
  fetchCurrentSubscription: async (): Promise<{
    tier_id: number | null;
    subscription: any | null;
  }> => {
    console.log("[merchantSubscriptionService] Fetching current subscription");

    try {
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: { action: 'fetch' },
      });

      if (error) {
        console.error("[merchantSubscriptionService] Error fetching subscription:", error);
        return { tier_id: null, subscription: null };
      }

      console.log("[merchantSubscriptionService] Current subscription:", data?.subscription);
      return {
        tier_id: data?.subscription?.tier_id || null,
        subscription: data?.subscription || null,
      };
    } catch (err: any) {
      console.error("[merchantSubscriptionService] Exception fetching subscription:", err.message);
      return { tier_id: null, subscription: null };
    }
  },

  /**
   * Create a new subscription for a merchant
   */
  createSubscription: async (
    merchantId: string,
    tierId: number,
    tierKey: string,
    tierName: string
  ): Promise<{ success: boolean; error?: string }> => {
    console.log("[merchantSubscriptionService] Creating subscription for merchant:", merchantId, "tier:", tierName);

    try {
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: {
          action: 'create',
          tier_key: tierKey,
          tier_name: tierName,
        },
      });

      if (error) {
        console.error("[merchantSubscriptionService] Error creating subscription:", error);
        return { success: false, error: error.message };
      }

      if (data?.success) {
        console.log("[merchantSubscriptionService] Subscription created successfully:", data.subscription);
        return { success: true };
      } else {
        console.error("[merchantSubscriptionService] Subscription creation failed:", data?.error);
        return { success: false, error: data?.error || 'Unknown error' };
      }
    } catch (err: any) {
      console.error("[merchantSubscriptionService] Exception creating subscription:", err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Get campaign usage for the current calendar month
   */
  getCampaignUsage: async (): Promise<{
    campaigns_used: number;
    campaigns_limit: number;
    dotd_used: number;
    dotd_limit: number;
    has_subscription: boolean;
  }> => {
    console.log("[merchantSubscriptionService] Fetching campaign usage");

    try {
      // Pass current year and month from client to Edge Function
      const now = new Date();
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: {
          action: 'campaign_usage',
          year: now.getFullYear(),
          month: now.getMonth()
        },
      });

      if (error) {
        console.error("[merchantSubscriptionService] Error fetching campaign usage:", error);
        return {
          campaigns_used: 0,
          campaigns_limit: 0,
          dotd_used: 0,
          dotd_limit: 0,
          has_subscription: false,
        };
      }

      console.log("[merchantSubscriptionService] Campaign usage:", data);
      return {
        campaigns_used: data?.campaigns_used || 0,
        campaigns_limit: data?.campaigns_limit || 0,
        dotd_used: data?.dotd_used || 0,
        dotd_limit: data?.dotd_limit || 0,
        has_subscription: data?.has_subscription || false,
      };
    } catch (err: any) {
      console.error("[merchantSubscriptionService] Exception fetching campaign usage:", err.message);
      return {
        campaigns_used: 0,
        campaigns_limit: 0,
        dotd_used: 0,
        dotd_limit: 0,
        has_subscription: false,
      };
    }
  },
};
