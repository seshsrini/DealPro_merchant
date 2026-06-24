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
  /**
   * True when we could NOT get a definitive answer from the registry/provider
   * (transient 5xx / network / cold start, persisting after retries). Lets the
   * UI allow the merchant through with the document flagged unverified, instead
   * of hard-blocking onboarding on an outage. False for a definitive answer
   * (verified, not-found, or name mismatch).
   */
  unreachable?: boolean;
  /** GST only: whether the registry's legal name matched the name supplied. */
  legalNameMatch?: boolean | null;
  /** GST only: the legal name returned by the registry. */
  registryLegalName?: string | null;
  /** GST only: the registry names we matched against (legal + trade). */
  registryNames?: string[];
}

export const kycVerificationService = {
  // `legalName` (GST only) is cross-checked against the registry's legal name —
  // a GSTIN that resolves to a different business is reported as not verified.
  //
  // Resilient: a transient edge/network failure (5xx, cold start, dropped
  // connection) is retried with backoff so a blip doesn't surface a scary
  // "Edge Function returned a non-2xx status code" to the merchant. Definitive
  // 4xx answers (bad/unknown number) are returned immediately — retrying can't
  // change them. The raw supabase-js message is never shown; we read the
  // function's own JSON error or fall back to a friendly line.
  async verify(docType: KycDocType, value: string, legalName?: string): Promise<KycVerifyResult> {
    const MAX_ATTEMPTS = 3;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const FRIENDLY = "Couldn't verify right now. Please check your connection and try again.";
    let lastMsg = FRIENDLY;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke("verify-business-document", {
          body: { doc_type: docType, number: value, legal_name: legalName || undefined },
        });

        if (!error) {
          // Function answered. A body-level error is a definitive business result
          // (e.g. number not found / name mismatch) — surface it, don't retry.
          if (data?.error) return { verified: false, error: data.error, unreachable: false };
          return {
            verified: !!data?.verified,
            data: data?.data,
            mock: data?.mock,
            legalNameMatch: data?.legal_name_match ?? null,
            registryLegalName: data?.registry_legal_name ?? null,
            registryNames: Array.isArray(data?.registry_names) ? data.registry_names : undefined,
            unreachable: false,
          };
        }

        // Non-2xx. Prefer the function's own JSON message over supabase-js's
        // generic "non-2xx status code" string.
        let bodyErr = "";
        try { const b = await (error as any).context?.json?.(); bodyErr = b?.error || ""; } catch { /* ignore */ }
        const status: number | undefined = (error as any)?.context?.status;

        // A 4xx with a real message is a definitive answer — return it as-is.
        if (typeof status === "number" && status >= 400 && status < 500 && bodyErr) {
          return { verified: false, error: bodyErr, unreachable: false };
        }

        // Transient (5xx / network / empty body) — retry with backoff, then
        // report as unreachable so the UI can allow-with-review.
        lastMsg = bodyErr || FRIENDLY;
        if (attempt < MAX_ATTEMPTS) { await sleep(500 * attempt); continue; }
        return { verified: false, error: lastMsg, unreachable: true };
      } catch (e) {
        // invoke threw (network / token). Retry, then fall back to friendly text.
        lastMsg = FRIENDLY;
        if (attempt < MAX_ATTEMPTS) { await sleep(500 * attempt); continue; }
        return { verified: false, error: lastMsg, unreachable: true };
      }
    }
    return { verified: false, error: lastMsg, unreachable: true };
  },
};
