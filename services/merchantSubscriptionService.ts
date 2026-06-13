
import { supabase } from "./supabaseClient";

export const merchantSubscriptionService = {
  /**
   * Change tier for an ALREADY-ACTIVE merchant. The change is parked server-side
   * and takes effect at the next billing cycle (no new mandate / immediate charge).
   */
  changeTier: async (tierKey: string): Promise<{ success: boolean; message?: string; effective_date?: string; new_amount?: number; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: { action: 'change_tier', tier_key: tierKey },
      });
      if (error) return { success: false, error: 'Unable to change plan. Please try again.' };
      return data;
    } catch {
      return { success: false, error: 'Unable to change plan. Please try again.' };
    }
  },

  /**
   * Check if a merchant has an active subscription
   */
  checkActiveSubscription: async (merchantId: string, accessToken?: string): Promise<{
    hasActiveSubscription: boolean;
    subscription_status?: string;
    current_tier_id?: number;
    plan_name?: string;
    trial_end?: string;
    trialExpired?: boolean;
    storeCount?: number;
  }> => {
    console.log("[merchantSubscriptionService] Checking active subscription for merchant:", merchantId);

    // Try edge function first, fall back to direct DB query if it fails (e.g., during fresh login when session isn't ready)
    try {
      const options: any = {
        body: { action: 'check', merchantId },
      };
      if (accessToken) {
        options.headers = { Authorization: `Bearer ${accessToken}` };
      }
      const { data, error } = await supabase.functions.invoke('merchant-subscription', options);

      if (!error && data) {
        console.log("[merchantSubscriptionService] Subscription check result:", data);
        return {
          hasActiveSubscription: data?.hasActiveSubscription || false,
          subscription_status: data?.subscription_status,
          plan_name: data?.plan_name,
          trial_end: data?.trial_end,
          trialExpired: data?.trialExpired || false,
          storeCount: data?.storeCount ?? 0,
        };
      }
      console.warn("[merchantSubscriptionService] Edge function failed, falling back to direct query:", error);
    } catch (err: any) {
      console.warn("[merchantSubscriptionService] Edge function exception, falling back to direct query:", err.message);
    }

    // Fallback: query tables directly
    try {
      const now = new Date().toISOString();
      const { data: sub } = await supabase
        .from('merchant_subscriptions')
        .select('id, status, plan_name, current_period_end, trial_end')
        .eq('merchant_id', merchantId)
        .eq('status', 'active')
        .gte('current_period_end', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count: storeCount } = await supabase
        .from('merchant_stores')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchantId);

      const trialEnd = sub?.trial_end || sub?.current_period_end;
      const trialExpired = trialEnd ? new Date(trialEnd) < new Date() : false;

      console.log("[merchantSubscriptionService] Fallback result — active:", !!sub, "stores:", storeCount);
      return {
        hasActiveSubscription: !!sub,
        subscription_status: sub?.status,
        plan_name: sub?.plan_name,
        trial_end: sub?.trial_end,
        trialExpired,
        storeCount: storeCount ?? 0,
      };
    } catch (fallbackErr: any) {
      console.error("[merchantSubscriptionService] Fallback query also failed:", fallbackErr.message);
      return { hasActiveSubscription: false };
    }
  },

  /**
   * Fetch current active subscription for a merchant
   */
  fetchCurrentSubscription: async (merchantId: string): Promise<{
    tier_id: number | null;
    subscription: any | null;
  }> => {
    console.log("[merchantSubscriptionService] Fetching current subscription");

    try {
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: { action: 'fetch', merchantId },
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
  ): Promise<{ success: boolean; error?: string; isTrialing?: boolean; trial_end?: string; subscriptionId?: number }> => {
    console.log("[merchantSubscriptionService] Creating subscription for merchant:", merchantId, "tier:", tierName);

    try {
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: {
          action: 'create',
          merchantId,
          tier_key: tierKey,
          tier_name: tierName,
        },
      });

      if (error) {
        console.error("[merchantSubscriptionService] Error creating subscription:", error);
        return { success: false, error: 'Unable to process subscription. Please try again.' };
      }

      if (data?.success) {
        console.log("[merchantSubscriptionService] Subscription created successfully:", data.subscription, "trialing:", data.isTrialing);
        return { success: true, isTrialing: data.isTrialing, trial_end: data.subscription?.trial_end, subscriptionId: data.subscriptionId };
      } else {
        console.error("[merchantSubscriptionService] Subscription creation failed:", data?.error);
        return { success: false, error: data?.error || 'Unknown error' };
      }
    } catch (err: any) {
      console.error("[merchantSubscriptionService] Exception creating subscription:", err.message);
      return { success: false, error: 'Unable to process subscription. Please try again.' };
    }
  },

  /**
   * Get campaign usage for the current calendar month
   */
  getCampaignUsage: async (merchantId: string): Promise<{
    campaigns_used: number;
    campaigns_limit: number;
    dotd_used: number;
    dotd_limit: number;
    has_subscription: boolean;
  }> => {
    console.log("[merchantSubscriptionService] Fetching campaign usage");

    try {
      const now = new Date();
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: {
          action: 'campaign_usage',
          merchantId,
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

  /**
   * Add loyalty redemption addon to an existing subscription
   */
  addLoyaltyAddon: async (
    merchantId: string,
    subscriptionId: number,
    subscriptionFee: number
  ): Promise<{ success: boolean; error?: string }> => {
    console.log("[merchantSubscriptionService] Adding loyalty addon for merchant:", merchantId);

    try {
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: {
          action: 'add_loyalty_addon',
          merchantId,
          subscription_id: subscriptionId,
          subscription_fee: subscriptionFee,
        },
      });

      if (error) {
        console.error("[merchantSubscriptionService] Error adding loyalty addon:", error);
        return { success: false, error: 'Unable to enroll in loyalty program. Please try again.' };
      }

      if (data?.success) {
        console.log("[merchantSubscriptionService] Loyalty addon added, total:", data.total_recurring_amount);
        return { success: true };
      }
      return { success: false, error: data?.error || 'Enrollment failed' };
    } catch (err: any) {
      console.error("[merchantSubscriptionService] Loyalty addon exception:", err.message);
      return { success: false, error: 'Unable to enroll in loyalty program. Please try again.' };
    }
  },

  /**
   * Cancel the merchant's active subscription (at end of billing period)
   */
  cancelSubscription: async (merchantId: string, reason: string): Promise<{
    success: boolean;
    current_period_end?: string;
    error?: string;
  }> => {
    console.log("[merchantSubscriptionService] Cancelling subscription, reason:", reason);
    try {
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: { action: 'cancel', merchantId, reason },
      });

      if (error) {
        console.error("[merchantSubscriptionService] Cancel error:", error);
        return { success: false, error: 'Unable to process subscription. Please try again.' };
      }

      if (data?.success) {
        console.log("[merchantSubscriptionService] Subscription cancelled:", data);
        return { success: true, current_period_end: data.current_period_end };
      }
      return { success: false, error: data?.error || 'Cancellation failed' };
    } catch (err: any) {
      console.error("[merchantSubscriptionService] Cancel exception:", err.message);
      return { success: false, error: 'Unable to process subscription. Please try again.' };
    }
  },
};
