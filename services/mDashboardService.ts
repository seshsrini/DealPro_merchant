

import { supabase } from "./supabaseClient";

export const mDashboardService = {
  // Calls Edge Function
  getMerchantDashboardMetrics: async (merchantId: string, activeRoiTab: 'review' | 'active' | 'expired' = 'active') => {
    console.log(`[mDashboardService] Calling Edge Function for merchant dashboard metrics for ${merchantId} with tab ${activeRoiTab}`);
    const { data, error } = await supabase.functions.invoke('get-metrics', { // Changed to 'get-metrics'
      body: { merchantId, activeRoiTab },
    });
    if (error) {
      console.error("[mDashboardService] Failed to fetch merchant dashboard metrics via Edge Function:", error);
      throw error; // Propagate error
    }
    return data;
  },

  /**
   * Fetches the total number of clicks for a specific set of campaign IDs.
   * Clicks are from all consumers on these campaigns.
   * Calls Edge Function.
   */
  getCampaignSpecificClicks: async (campaignIds: string[]): Promise<Record<string, number>> => {
    if (campaignIds.length === 0) return {};
    console.log(`[mDashboardService] Calling Edge Function for campaign specific clicks for IDs: ${campaignIds.join(', ')}`);
    const { data, error } = await supabase.functions.invoke('get-campaign-specific-clicks', { // Corrected EF name
      body: { campaignIds },
    });
    if (error) {
      console.error("Failed to fetch campaign specific clicks via Edge Function:", error);
      throw error; // Propagate error
    }
    return data as Record<string, number>;
  },

  /**
   * Fetches the total number of redemptions for a specific set of campaign IDs for a merchant.
   * Redemptions are for campaigns owned by the merchant, marked as `is_redeemed: true`.
   * Calls Edge Function.
   */
  getCampaignSpecificRedemptions: async (merchantId: string, campaignIds: string[]): Promise<Record<string, number>> => {
    if (campaignIds.length === 0) return {};
    console.log(`[mDashboardService] Calling Edge Function for campaign specific redemptions for merchant ${merchantId} and IDs: ${campaignIds.join(', ')}`);
    const { data, error } = await supabase.functions.invoke('get-campaign-specific-redemptions', { // Corrected EF name
      body: { merchantId, campaignIds },
    });
    if (error) {
      console.error("Failed to fetch campaign specific redemptions via Edge Function:", error);
      throw error; // Propagate error
    }
    return data as Record<string, number>;
  },

  /**
   * Fetches the total lifetime deals for a merchant.
   * Calls dedicated Edge Function.
   */
  getTotalLifetimeDeals: async (merchantId: string): Promise<{ count: number }> => {
    console.log(`[mDashboardService] Invoking 'get-total-lifetime-deals' EF for merchant ID: ${merchantId}`);
    const { data, error } = await supabase.functions.invoke('get-total-lifetime-deals', {
      body: { merchantId },
    });
    if (error) {
      console.error("[mDashboardService] EF Invocation Error for total lifetime deals:", error);
      throw error;
    }
    return data; // Edge function already returns { count: number }
  },

  /**
   * Fetches the total lifetime clicks for a merchant.
   * Calls dedicated Edge Function.
   */
  getTotalLifetimeClicks: async (merchantId: string): Promise<{ count: number }> => {
    console.log(`[mDashboardService] Invoking 'get-total-lifetime-clicks' EF for merchant ID: ${merchantId}`);
    const { data, error } = await supabase.functions.invoke('get-total-lifetime-clicks', {
      body: { merchantId },
    });
    if (error) {
      console.error("[mDashboardService] EF Invocation Error for total lifetime clicks:", error);
      throw error;
    }
    return data; // Edge function already returns { count: number }
  },

  /**
   * Fetches the total lifetime redemptions for a merchant (all interactions).
   * Calls dedicated Edge Function.
   */
  getTotalLifetimeRedemptions: async (merchantId: string): Promise<{ count: number }> => {
    console.log(`[mDashboardService] Invoking 'get-total-lifetime-redemptions' EF for merchant ID: ${merchantId}`);
    const { data, error } = await supabase.functions.invoke('get-total-lifetime-redemptions', {
      body: { merchantId },
    });
    if (error) {
      console.error("[mDashboardService] EF Invocation Error for total lifetime redemptions:", error);
      throw error;
    }
    return data;
  },

  /**
   * Fetches the total number of invites sent by a merchant.
   * Calls dedicated Edge Function.
   */
  getTotalInvitesSent: async (merchantId: string): Promise<{ count: number }> => {
    console.log(`[mDashboardService] Invoking 'get-total-invites-sent' EF for merchant ID: ${merchantId}`);
    const { data, error } = await supabase.functions.invoke('get-total-invites-sent', {
      body: { merchantId },
    });
    if (error) {
      console.error("[mDashboardService] EF Invocation Error for total invites sent:", error);
      throw error;
    }
    return data;
  },

  /**
   * Fetches the total number of invites accepted for a merchant.
   * Calls dedicated Edge Function.
   */
  getTotalInvitesAccepted: async (merchantId: string): Promise<{ count: number }> => {
    console.log(`[mDashboardService] Invoking 'get-total-invites-accepted' EF for merchant ID: ${merchantId}`);
    const { data, error } = await supabase.functions.invoke('get-total-invites-accepted', {
      body: { merchantId },
    });
    if (error) {
      console.error("[mDashboardService] EF Invocation Error for total invites accepted:", error);
      throw error;
    }
    return data;
  },
};