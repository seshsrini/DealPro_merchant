import { supabase } from "./supabaseClient";
import { Deal } from "../types";

export const dealDetailsService = {
  fetchDealDetails: async (campaignId: string): Promise<Deal> => {
    console.log(`[dealDetailsService] Fetching details for campaign: ${campaignId}`);

    try {
      const { data, error } = await supabase.functions.invoke('get-one', {
        body: { campaignId },
      });

      if (error) {
        console.error("[dealDetailsService] Edge Function returned an error:", error);
        throw new Error('Unable to load deal details. Please try again.');
      }

      console.log(`[dealDetailsService] Successfully fetched deal details`);
      console.log(`[dealDetailsService] address: ${data.address}, storeHrs: ${data.storeHrs}, landmark: ${data.landmark}`);

      return data;

    } catch (err) {
      console.error(`[dealDetailsService] Network or unexpected error:`, err);
      throw new Error('Unable to load deal details. Please try again.');
    }
  },

  // Calls Edge Function to toggle favorite status
  toggleFavorite: async (userId: string, campaignId: string, merchantId: string) => {
    console.log("[dealDetailsService] Invoking Edge Function 'toggle-favorite' with:", { userId, campaignId, merchantId });
    const { data, error } = await supabase.functions.invoke('toggle-favorite', {
      body: { userId, campaignId, merchantId },
    });
    if (error) {
      console.error("Failed to toggle favorite via Edge Function:", error);
      throw new Error('Unable to load deal details. Please try again.');
    }
    return data;
  },
};