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
  /** GST only: whether the registry's legal name matched the name supplied. */
  legalNameMatch?: boolean | null;
  /** GST only: the legal name returned by the registry. */
  registryLegalName?: string | null;
}

export const kycVerificationService = {
  // `legalName` (GST only) is cross-checked against the registry's legal name —
  // a GSTIN that resolves to a different business is reported as not verified.
  async verify(docType: KycDocType, value: string, legalName?: string): Promise<KycVerifyResult> {
    try {
      const { data, error } = await supabase.functions.invoke("verify-business-document", {
        body: { doc_type: docType, number: value, legal_name: legalName || undefined },
      });
      if (error) return { verified: false, error: error.message };
      if (data?.error) return { verified: false, error: data.error };
      return {
        verified: !!data?.verified,
        data: data?.data,
        mock: data?.mock,
        legalNameMatch: data?.legal_name_match ?? null,
        registryLegalName: data?.registry_legal_name ?? null,
      };
    } catch (e) {
      return { verified: false, error: e instanceof Error ? e.message : "Verification failed" };
    }
  },
};
