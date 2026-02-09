
import { supabase } from "./supabaseClient";
import { CampaignInteraction } from "../types";

export const redemptionHistoryService = {
  getRedemptionHistory: async (userId: string): Promise<CampaignInteraction[]> => {
    console.log(`[redemptionHistoryService] Invoking get-redemptions for: ${userId}`);
    try {
      const { data, error } = await supabase.functions.invoke('get-redemptions', {
        body: { userId },
      });

      if (error) {
        console.error("[redemptionHistoryService] Edge Function Error:", error);
        throw new Error(error.message || "History retrieval failed.");
      }

      return (data || []) as CampaignInteraction[];
    } catch (e: any) {
      console.error("[redemptionHistoryService] Critical Error:", e.message);
      throw e;
    }
  },
};
