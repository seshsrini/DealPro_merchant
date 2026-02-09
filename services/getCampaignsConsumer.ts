
import { supabase } from "./supabaseClient";
import { Deal } from "../types";

export const getCampaignsConsumer = {
  /**
   * Fetches active consumer deals by invoking the 'get-all' Supabase Edge Function.
   * Sends a POST request to allow for complex filtering (Geo-radius or City).
   * This function is now EXCLUSIVE to general location-based deal fetching.
   */
  getDeals: async (searchParams?: { 
    latitude?: number; 
    longitude?: number; 
    radius?: number; 
    cityFilter?: string; 
  }): Promise<Deal[]> => {
    
    console.log("[getCampaignsConsumer.getDeals] Initializing general deals fetch...");

    // Construct the payload to match exactly what the get-all Edge Function expects
    const payload = {
      latitude: searchParams?.latitude || null,
      longitude: searchParams?.longitude || null,
      radius: searchParams?.radius || null,
      cityFilter: searchParams?.cityFilter || null,
      // No storeId sent here, as this function is for general deals
    };

    try {
      const response = await supabase.functions.invoke('get-all', {
        method: 'POST',
        body: payload, // Explicitly sending the mapped payload
      });

      if (response.error) {
        console.error("[getCampaignsConsumer.getDeals] EF Execution Error:", response.error);
        throw response.error;
      }

      const deals = response.data || [];
      
      console.log(`[getCampaignsConsumer.getDeals] Successfully fetched ${deals.length} general deals.`);
      return deals as Deal[];

    } catch (e: any) {
      console.error("[getCampaignsConsumer.getDeals] Critical Catch:", {
        name: e.name,
        message: e.message,
        details: e
      });
      throw e; 
    }
  },

  /**
   * Fetches active consumer deals for a specific store ID.
   * This function uses a new dedicated Edge Function: 'get-campaigns-by-store'.
   */
  getDealsByStoreId: async (storeId: string): Promise<Deal[]> => {
    console.log(`[getCampaignsConsumer.getDealsByStoreId] Initializing store-specific deals fetch for storeId: ${storeId}`);

    const payload = { storeId: storeId };

    try {
      const response = await supabase.functions.invoke('get-campaigns-by-store', {
        method: 'POST',
        body: payload,
      });

      if (response.error) {
        console.error("[getCampaignsConsumer.getDealsByStoreId] EF Execution Error:", response.error);
        throw response.error;
      }

      const deals = response.data || [];

      console.log(`[getCampaignsConsumer.getDealsByStoreId] Successfully fetched ${deals.length} deals for storeId: ${storeId}`);
      return deals as Deal[];

    } catch (e: any) {
      console.error("[getCampaignsConsumer.getDealsByStoreId] Critical Catch:", {
        name: e.name,
        message: e.message,
        details: e
      });
      throw e;
    }
  },
};
