/**
 * DEV-ONLY OTP bypass.  ⚠  MUST NEVER BE TRUE IN STAGE OR PROD.
 *
 * Purpose: a demo APK for a couple of sales reps, where waiting for an SMS is
 * pure friction. When active, the OTP modal auto-succeeds and the normal
 * login-merchant / registration path runs unchanged (it still needs a real
 * merchant account — this skips the Firebase code check, nothing else).
 *
 * Two independent conditions must BOTH hold, so this cannot activate by accident:
 *
 *   1. VITE_DEV_SKIP_OTP === 'true'  — an explicit opt-in that lives only in
 *      MerchantDEV/.env.local. PROD/STAGE .env files must never contain it.
 *   2. The Supabase project is the shared DEV project (hyijwfovsvetpyrbqfcd).
 *      This binds the bypass to DEV infrastructure: even if the flag leaked
 *      into a build pointed at PROD (trrinhrajmsnkjnwtncz), it stays inert.
 *
 * Verify before ANY non-DEV build:
 *   grep -c "DEV_OTP_BYPASS_ACTIVE" dist/assets/index-*.js   // must be 0 in the flow when off
 *   confirm VITE_DEV_SKIP_OTP is absent from that build's .env
 */
const DEV_SUPABASE_REF = "hyijwfovsvetpyrbqfcd";

export function isDevOtpBypassEnabled(): boolean {
  const flag = import.meta.env.VITE_DEV_SKIP_OTP === "true";
  const url = String(import.meta.env.VITE_SUPABASE_URL || "");
  const onDevProject = url.includes(DEV_SUPABASE_REF);
  const active = flag && onDevProject;
  if (active) {
    // Loud, unmissable marker in logcat / console for anyone inspecting a build.
    console.warn(
      "[DEV_OTP_BYPASS_ACTIVE] OTP verification is BYPASSED — DEV demo build only. " +
        "If you see this in STAGE or PROD, STOP and rebuild."
    );
  }
  return active;
}
