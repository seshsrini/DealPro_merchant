import { supabase } from "./supabaseClient";

// Verifies a merchant's business document (GST / Udyam / FSSAI / Trade Licence)
// against the KYC provider via the verify-business-document edge function. The
// function stores the raw response + a `<doc>_verified` flag on merchant_profiles.

export type KycDocType = "gstin" | "udyam" | "fssai" | "trade_license";

export interface KycVerifyResult {
  verified: boolean;
  data?: unknown;
  mock?: boolean;
  error?: string;
}

export const kycVerificationService = {
  async verify(docType: KycDocType, value: string): Promise<KycVerifyResult> {
    try {
      const { data, error } = await supabase.functions.invoke("verify-business-document", {
        body: { doc_type: docType, number: value },
      });
      if (error) return { verified: false, error: error.message };
      if (data?.error) return { verified: false, error: data.error };
      return { verified: !!data?.verified, data: data?.data, mock: data?.mock };
    } catch (e) {
      return { verified: false, error: e instanceof Error ? e.message : "Verification failed" };
    }
  },
};
