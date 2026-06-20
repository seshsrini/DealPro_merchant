import { supabase } from './supabaseClient';
import { clearSignupComplete } from './signupCompleteCache';
import { Preferences } from '@capacitor/preferences';

const USER_KEY = 'dealpro_merchant_session';

/**
 * Session persistence service for the merchant app.
 *
 * Goal: once a merchant has signed in on a device, they must NEVER be sent back
 * to the OTP flow. The full user object (phone, country_code, tokens) saved here
 * is what App.tsx's splash restore + cached-phone silent re-auth depend on.
 *
 * Durability — why we write to TWO stores:
 *  - window.localStorage is the SYNCHRONOUS source of truth. Every getSavedUser()
 *    call site reads it directly, so the hot path stays sync and unchanged.
 *  - Capacitor Preferences (native SharedPreferences on Android / UserDefaults on
 *    iOS) is a durable MIRROR. Android WebViews can evict localStorage under
 *    storage pressure or wipe it on "clear cache" — but Preferences survives
 *    until the app is uninstalled. hydrateSessionFromDurableStore() runs once at
 *    boot and copies the session back into localStorage if it was evicted, so an
 *    affected merchant recovers silently instead of being OTP-prompted.
 *
 * All Preferences calls are best-effort. If the plugin isn't available (web, or a
 * native build that hasn't run `npx cap sync`), every call no-ops and we fall
 * back to localStorage-only — identical to the previous behavior. Nothing breaks.
 */

async function durableSet(key: string, value: string): Promise<void> {
  try { await Preferences.set({ key, value }); } catch { /* plugin unavailable — localStorage is the fallback */ }
}
async function durableGet(key: string): Promise<string | null> {
  try { const { value } = await Preferences.get({ key }); return value ?? null; } catch { return null; }
}
async function durableRemove(key: string): Promise<void> {
  try { await Preferences.remove({ key }); } catch { /* noop */ }
}

export const biometricService = {
  async saveSession(user: any): Promise<void> {
    const serialized = JSON.stringify(user);
    localStorage.setItem(USER_KEY, serialized);
    // Mirror to durable native storage so a WebView localStorage eviction can't
    // strand the merchant in the OTP flow. Awaited so callers that await
    // saveSession also get the durable write committed.
    await durableSet(USER_KEY, serialized);
  },

  getSavedUser(): any | null {
    try {
      const saved = localStorage.getItem(USER_KEY);
      if (!saved) return null;
      const user = JSON.parse(saved);
      if (!user || !user.id || !user.isLoggedIn) return null;
      return user;
    } catch {
      return null;
    }
  },

  async clearSession(): Promise<void> {
    // Read the merchant id from the saved session BEFORE we wipe it, so we can
    // also clear the signup-complete cache entry for that specific merchant.
    // If a different merchant later signs in on this device, they get a clean
    // fall-through to the 5-field profile check in AuthStack rather than
    // inheriting the previous owner's "signup done" flag.
    try {
      const saved = localStorage.getItem(USER_KEY);
      if (saved) {
        const prev = JSON.parse(saved);
        if (prev?.id) clearSignupComplete(prev.id);
      }
    } catch { /* best-effort — falls through to standard cleanup */ }
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('dealpro_merchant_biometric_asked');
    // Wipe the durable mirror too — an explicit logout must NOT be silently
    // undone by hydrateSessionFromDurableStore() on the next boot.
    await durableRemove(USER_KEY);
    await supabase.auth.signOut();
  },
};

/**
 * Restore the saved session from durable native storage into localStorage when
 * the WebView has evicted localStorage but the native store still holds it.
 *
 * Must run at app boot BEFORE the splash restore reads getSavedUser(), so an
 * evicted merchant is recovered silently instead of being routed to OTP. Safe to
 * call when localStorage already has the session (no-op) or when the plugin is
 * unavailable (no-op).
 */
/**
 * One-line boot diagnostic. Logs whether each session store survived the app
 * kill, so a recurrence of "re-OTP on reopen" is instantly traceable from tester
 * logs (adb logcat | grep BootDiag). Reads the RAW state — call it BEFORE
 * hydrateSessionFromDurableStore() so an eviction is visible.
 */
const SUPABASE_AUTH_KEY = 'dealpro-merchant-auth';
export async function logBootDiagnostics(): Promise<void> {
  try {
    const lsSession = localStorage.getItem(USER_KEY);
    const durable = await durableGet(USER_KEY);
    const lsSupabase = !!localStorage.getItem(SUPABASE_AUTH_KEY);
    let saved: any = null;
    try { saved = lsSession ? JSON.parse(lsSession) : null; } catch { /* corrupt */ }
    let liveSupabase = 'null';
    try {
      const { data } = await supabase.auth.getSession();
      liveSupabase = data?.session?.user?.id ? String(data.session.user.id).slice(0, 8) : 'null';
    } catch { /* ignore */ }
    console.log(
      `[BootDiag] savedSession=${!!lsSession} durableMirror=${!!durable} supabaseLS=${lsSupabase} ` +
      `liveSupabaseSession=${liveSupabase} userId=${saved?.id ? String(saved.id).slice(0, 8) : 'none'} ` +
      `hasTokens=${!!(saved?.access_token && saved?.refresh_token)} isLoggedIn=${!!saved?.isLoggedIn}`
    );
  } catch (e: any) {
    console.warn('[BootDiag] failed:', e?.message || e);
  }
}

export async function hydrateSessionFromDurableStore(): Promise<void> {
  try {
    if (localStorage.getItem(USER_KEY)) return; // localStorage intact — nothing to recover
    const durable = await durableGet(USER_KEY);
    if (!durable) return;
    const parsed = JSON.parse(durable);
    if (parsed?.id && parsed?.isLoggedIn) {
      localStorage.setItem(USER_KEY, durable);
      console.log('[biometricService] Recovered saved session from durable store after localStorage eviction.');
    }
  } catch (err: any) {
    console.warn('[biometricService] Durable hydrate skipped:', err?.message || err);
  }
}
