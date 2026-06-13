/**
 * signupCompleteCache — tiny localStorage flag that records "this merchant
 * finished the signup wizard on this device". Set by handleFinalSubmit after
 * the atomic write to merchant_profiles + merchant_stores succeeds; checked in
 * AuthStack.handlePostLoginNavigation to short-circuit the 5-field profile
 * completeness check, so login doesn't have to evaluate it on every cold open.
 *
 * Why this is safe:
 *  - Signup completion is monotonic. We only set the flag after the Edge
 *    Function returns success, which atomically populates all 5 fields
 *    (full_name, store_name, business_type, terms_accepted, privacy_accepted).
 *    A `true` here therefore guarantees those fields are populated in DB.
 *  - Missing flag → fall through to the existing field check. No regression.
 *  - Cleared on logout (via biometricService.clearSession) so a different
 *    merchant signing in on the same device doesn't inherit the flag.
 */

const STORAGE_KEY = 'dealpro_signup_complete_cache_v1';
const SCHEMA_VERSION = 1;

interface PersistedEntry {
  /** ISO timestamp of when handleFinalSubmit recorded success. */
  completedAt: string;
}

interface PersistedShape {
  v: number;
  byMerchant: Record<string, PersistedEntry>;
}

function readAll(): Record<string, PersistedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedShape;
    if (!parsed || parsed.v !== SCHEMA_VERSION || !parsed.byMerchant) return {};
    return parsed.byMerchant;
  } catch {
    return {};
  }
}

function writeAll(byMerchant: Record<string, PersistedEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, byMerchant }));
  } catch {
    // Quota / disabled storage — ignore. Worst case we fall back to the
    // 5-field DB check on the next login.
  }
}

/** Record that this merchant finished signup. Call after a successful submit. */
export function markSignupComplete(merchantId: string): void {
  if (!merchantId) return;
  const all = readAll();
  all[merchantId] = { completedAt: new Date().toISOString() };
  writeAll(all);
}

/** True if we have already seen this merchant finish signup on this device. */
export function isSignupKnownComplete(merchantId: string): boolean {
  if (!merchantId) return false;
  return !!readAll()[merchantId];
}

/** Clear the flag. With a merchantId clears one entry; without, nukes the lot. */
export function clearSignupComplete(merchantId?: string): void {
  if (!merchantId) {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    return;
  }
  const all = readAll();
  if (merchantId in all) {
    delete all[merchantId];
    writeAll(all);
  }
}
