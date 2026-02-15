
import { supabase } from "./supabaseClient";

export const redeemNowservice = {
  createClaim: async (consumerId: string, merchantId: string, campaignId: string, claimNo: string, isDealOfDay: boolean = false) => {
    console.log('[redeemNowservice] Creating claim with:', { consumerId, merchantId, campaignId, claimNo, isDealOfDay });

    const { data, error } = await supabase.functions.invoke('create-claim', {
      body: { consumerId, merchantId, campaignId, claimNo, isDealOfDay },
    });

    if (error) {
      console.error("[redeemNowservice] Request Failed:", error);
      console.error("[redeemNowservice] Error details:", JSON.stringify(error, null, 2));
      console.error("[redeemNowservice] Response data:", data);
      throw new Error(error.message || data?.error || "Redemption Protocol Offline.");
    }

    console.log('[redeemNowservice] Claim created successfully:', data);
    return data; // Return the full data object with { claimNo, message }
  },
};
