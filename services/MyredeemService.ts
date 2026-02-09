
import { supabase } from "./supabaseClient";
import { CampaignInteraction } from "../types";

export const MyredeemService = {
  // Calls Edge Function
  getPendingRedemptionSurveys: async (userId: string): Promise<CampaignInteraction[]> => {
    console.log(`[MyredeemService] Calling Edge Function to fetch pending redemption surveys for consumer_id: ${userId}`);
    const { data, error } = await supabase.functions.invoke('redemption/get-pending-surveys', { // Changed EF name
      body: { userId },
    });
    if (error) {
      console.error("[MyredeemService] Error fetching pending redemption surveys via Edge Function:", error);
      throw error; // Propagate error
    }
    return data as CampaignInteraction[];
  },

  // Calls Edge Function
  getPendingFeedbackClaims: async (userId: string): Promise<CampaignInteraction[]> => {
    console.log(`[MyredeemService] Calling Edge Function to fetch pending feedback claims for consumer_id: ${userId}`);
    const { data, error } = await supabase.functions.invoke('redemption/get-pending-feedback-claims', { // Changed EF name
      body: { userId },
    });
    if (error) {
      console.error("[MyredeemService] Error fetching pending feedback claims via Edge Function:", error);
      throw error; // Propagate error
    }
    return data as CampaignInteraction[];
  },

  // Calls Edge Function
  updateClaimFeedback: async (interactionId: string, rating: number, comments: string) => {
    console.log(`[MyredeemService] Calling Edge Function to update claim feedback for interaction_id: ${interactionId}`);
    const { data, error } = await supabase.functions.invoke('redemption/update-feedback', { // Changed EF name
      body: { interactionId, rating, comments },
    });
    if (error) {
      console.error("[MyredeemService] Error updating claim feedback via Edge Function:", error);
      throw error; // Propagate error
    }
    return data;
  },
};
