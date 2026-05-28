
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// Load Supabase credentials from environment variables for security
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate that required environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SupabaseClient] CRITICAL: Missing Supabase credentials in environment variables!');
  console.error('[SupabaseClient] Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local');
} 

// Log Supabase configuration for debugging immediately after definition
console.log(`[SupabaseClient] Initializing with URL: ${supabaseUrl}`);
console.log(`[SupabaseClient] Using Anon Key: ${supabaseAnonKey.substring(0, 10)}... (first 10 chars)`);


// Initialize the client with the anon key initially
// CRITICAL: enable persistSession + autoRefreshToken so JWTs auto-refresh after the 1hr expiry
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'dealpro-merchant-auth',
  },
});

// Keep Authorization header in sync when tokens refresh.
// IMPORTANT: mutate in-place — do NOT reassign (supabase as any).headers to a new object.
// supabase.functions.headers shares the same object reference as supabase.headers;
// reassigning would disconnect that shared reference and leave functions using a stale header.
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.access_token) {
    (supabase as any).headers['Authorization'] = `Bearer ${session.access_token}`;
    if (event === 'TOKEN_REFRESHED') {
      console.log('[SupabaseClient] Token refreshed — Authorization header updated.');
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Resume-based JWT refresh.
// Mobile WebViews and browsers throttle/pause setInterval when the app is
// backgrounded. A 4-min wizard-level heartbeat is useless if the user
// background-stashes the app for 2 hours. The Page Visibility API DOES still
// fire visibilitychange on foreground/background transitions in Capacitor
// WebViews and all major browsers — so we use it as the authoritative signal:
// every time the app becomes visible, force a refresh (throttled to once per
// 30s so rapid focus toggles don't spam the auth server).
// ──────────────────────────────────────────────────────────────────────────
if (typeof document !== 'undefined') {
  let lastResumeRefresh = 0;
  // Once a refresh fails because the refresh token is dead, don't bother
  // retrying every 30s — clear the stored session and stop trying until the
  // user logs in again.
  let refreshDisabledUntilLogin = false;

  const refreshOnResume = async () => {
    if (refreshDisabledUntilLogin) return;
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastResumeRefresh < 30_000) return;

    // Don't try to refresh if there's no session at all (e.g. user is on
    // the signup screen and hasn't logged in yet). Avoids the 401 noise
    // from supabase-js calling /auth/v1/token without a real refresh token.
    const { data: existing } = await supabase.auth.getSession();
    if (!existing?.session?.refresh_token) return;

    lastResumeRefresh = now;
    console.log('[SupabaseClient] App became visible — refreshing session.');
    try {
      const res = await supabase.auth.refreshSession();
      if (res.error) {
        console.warn('[SupabaseClient] Resume refresh failed:', res.error.message);
        // "Invalid API key", "Invalid Refresh Token", "Refresh Token Not Found",
        // etc. — the stored session is dead. Clear it so we don't keep
        // hitting /token every 30s and burning the user's console with
        // 401s until login.
        const msg = res.error.message || '';
        if (/invalid|not.found|expired|missing/i.test(msg)) {
          refreshDisabledUntilLogin = true;
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          console.log('[SupabaseClient] Cleared stale local session; pause until next login.');
        }
      } else {
        console.log('[SupabaseClient] Resume refresh succeeded.');
      }
    } catch (err: any) {
      console.warn('[SupabaseClient] Resume refresh threw:', err?.message || err);
    }
  };

  // Re-enable resume-refresh when a fresh login happens.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      refreshDisabledUntilLogin = false;
    }
  });

  document.addEventListener('visibilitychange', refreshOnResume);
  // Also refresh immediately on focus events for desktop browsers where
  // visibilitychange may not always fire on tab refocus.
  window.addEventListener('focus', refreshOnResume);
}

/**
 * Ensures the current session has a fresh (non-expired) JWT token.
 * Uses a short-lived in-memory cache so that multiple concurrent Edge Function
 * calls (e.g. on dashboard mount) don't each trigger their own getSession()
 * network call — the first call verifies, the rest return instantly.
 */
let _refreshPromise: Promise<string> | null = null;
let _cachedToken: string | null = null;
let _cachedTokenExpiresAt = 0; // Unix seconds

export const ensureFreshToken = async (): Promise<string> => {
  // Fast path: if we verified the token recently and it's not near expiry, return it
  const nowSec = Math.floor(Date.now() / 1000);
  if (_cachedToken && _cachedTokenExpiresAt - nowSec > 120) {
    return _cachedToken;
  }

  const { data, error } = await supabase.auth.getSession();
  if (!error && data.session?.access_token) {
    const expiresAt = data.session.expires_at || 0;
    const secondsLeft = expiresAt - nowSec;
    if (secondsLeft > 120) {
      _cachedToken = data.session.access_token;
      _cachedTokenExpiresAt = expiresAt;
      return data.session.access_token;
    }
    console.log(`[SupabaseClient] Token expires in ${secondsLeft}s — refreshing proactively`);
  }
  // Mutex: if a refresh is already in progress, reuse that promise
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        console.error('[SupabaseClient] Token refresh failed:', refreshError?.message);
        // Invalidate cache so next call doesn't use stale token
        _cachedToken = null;
        _cachedTokenExpiresAt = 0;
        throw new Error('Session expired. Please log in again.');
      }
      console.log('[SupabaseClient] Token refreshed successfully.');
      _cachedToken = refreshData.session.access_token;
      _cachedTokenExpiresAt = refreshData.session.expires_at || (nowSec + 3600);
      return refreshData.session.access_token;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
};

/**
 * Forcefully recover a working session: try refreshSession first, then fall back to
 * silent re-auth via the cached merchant phone (`merchantOtpLogin`). Used at critical
 * boundaries like handlePublish where a 401 is unacceptable for the user experience.
 *
 * Returns true on success, false if the user truly needs to log in again.
 *
 * Pass the dependencies in to avoid this module taking direct deps on biometricService /
 * userService (would cause an import cycle since both import this module).
 */
export const recoverSessionOrSilentReauth = async (deps: {
  getSavedUser: () => { phone?: string | null; country_code?: string | null } | null;
  reAuth: (phone: string, countryCode: string) => Promise<{ session?: { access_token: string; refresh_token: string } | null }>;
  onReAuthSuccess?: (session: { access_token: string; refresh_token: string }) => void;
}): Promise<boolean> => {
  // 1. Try a normal refresh first (fast path).
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data?.session?.access_token) {
      _cachedToken = data.session.access_token;
      _cachedTokenExpiresAt = data.session.expires_at || (Math.floor(Date.now() / 1000) + 3600);
      return true;
    }
  } catch {
    // fall through to silent re-auth
  }

  // 2. refreshSession failed (refresh token dead). Try silent re-auth via cached phone.
  const saved = deps.getSavedUser();
  const phone = saved?.phone;
  const cc = saved?.country_code || '+91';
  if (!phone) {
    console.warn('[SupabaseClient] Silent re-auth not possible — no cached phone.');
    return false;
  }
  try {
    console.log('[SupabaseClient] refreshSession dead — attempting silent re-auth via cached phone.');
    const { session } = await deps.reAuth(phone, cc);
    if (!session?.access_token || !session.refresh_token) {
      console.warn('[SupabaseClient] Silent re-auth returned no session.');
      return false;
    }
    // Hydrate the supabase client with the fresh session so subsequent calls work.
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    _cachedToken = session.access_token;
    _cachedTokenExpiresAt = Math.floor(Date.now() / 1000) + 3600;
    deps.onReAuthSuccess?.(session);
    console.log('[SupabaseClient] Silent re-auth succeeded.');
    return true;
  } catch (err: any) {
    console.warn('[SupabaseClient] Silent re-auth failed:', err?.message || err);
    return false;
  }
};

// Wrap functions.invoke to automatically refresh token before every authenticated Edge Function call.
// Unauthenticated calls skip token refresh entirely.
const originalInvoke = supabase.functions.invoke.bind(supabase.functions);
const unauthFunctions = ['validate-identifier', 'register-user', 'login-merchant', 'search-localities-by-city', 'get-states', 'get-cities', 'product-search'];

async function attachFreshAuth(functionName: string, options?: any) {
  if (unauthFunctions.includes(functionName)) return options;
  const hasAuthHeader = options?.headers?.Authorization || options?.headers?.authorization;
  if (hasAuthHeader) return options;
  const freshToken = await ensureFreshToken();
  return {
    ...(options || {}),
    headers: {
      ...(options?.headers || {}),
      'Authorization': `Bearer ${freshToken}`,
    },
  };
}

supabase.functions.invoke = async (functionName: string, options?: any) => {
  let finalOptions: any;
  try {
    finalOptions = await attachFreshAuth(functionName, options);
  } catch (err: any) {
    console.error('[SupabaseClient] Token refresh failed for', functionName, ':', err?.message);
    _cachedToken = null;
    _cachedTokenExpiresAt = 0;
    // Don't throw — try the call anyway, the 401 retry below may save it
    finalOptions = options;
  }

  let result = await originalInvoke(functionName, finalOptions);

  // Retry once on 401 — force refresh and try again. Handles stale-token scenarios.
  const errMsg = (result.error as any)?.message || '';
  const errCtxStatus = (result.error as any)?.context?.status;
  // Also check the response body — some edge functions return { error: "Unauthorized: ..." }
  // as a 401 JSON body which supabase-js wraps differently.
  const bodyError = typeof result.data === 'object' && result.data?.error ? String(result.data.error) : '';
  const isUnauthorized = errCtxStatus === 401
    || /401|unauthor|invalid token|expired/i.test(errMsg)
    || /unauthor|invalid token|expired/i.test(bodyError);
  if (isUnauthorized && !unauthFunctions.includes(functionName)) {
    console.warn('[SupabaseClient] 401 from', functionName, '— forcing token refresh and retrying');
    try {
      // Force refresh by clearing the cached promise and calling refreshSession directly
      _refreshPromise = null;
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session?.access_token) {
        const retryOptions = {
          ...(options || {}),
          headers: {
            ...(options?.headers || {}),
            'Authorization': `Bearer ${refreshData.session.access_token}`,
          },
        };
        (supabase as any).headers['Authorization'] = `Bearer ${refreshData.session.access_token}`;
        result = await originalInvoke(functionName, retryOptions);
      }
    } catch (retryErr: any) {
      console.error('[SupabaseClient] Retry refresh failed:', retryErr?.message);
    }
  }
  return result;
};

/**
 * Updates the global Supabase client with an active session.
 * On app reopen, the saved access_token may be expired (1hr lifetime) but the
 * refresh_token is still valid. We setSession first, then immediately refreshSession
 * to get fresh tokens — this ensures the Supabase client has a valid session
 * even when restoring from localStorage after hours/days.
 * @param session The Supabase Session object containing access_token and refresh_token.
 * @returns true if session is valid, false if refresh failed (user must re-login).
 */
export const updateSupabaseSession = async (session: Session | null): Promise<boolean> => {
  if (session) {
    // Check if the Supabase client already has an active session (e.g., from verifyOtp during login).
    // If so, skip setSession to avoid token conflicts — just ensure the header is set.
    const { data: existing } = await supabase.auth.getSession();
    if (existing?.session?.access_token && existing.session.user?.id) {
      (supabase as any).headers['Authorization'] = `Bearer ${existing.session.access_token}`;
      console.log(`[SupabaseClient] Active session found for user: ${existing.session.user.id}. Header synced.`);
      return true;
    }

    // No active session — restoring from localStorage. Seed the tokens and refresh.
    try {
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (error) {
        console.warn('[SupabaseClient] setSession warning:', error.message);
      }
    } catch (err: any) {
      console.warn('[SupabaseClient] setSession failed:', err.message);
    }

    // Immediately refresh to get a valid access_token.
    // The saved access_token from localStorage may be hours/days old (expired).
    // refreshSession uses the refresh_token to obtain fresh tokens.
    // Returns false if refresh fails (refresh token fully expired → user must re-login).
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        console.warn('[SupabaseClient] refreshSession failed — refresh token likely expired:', refreshError?.message);
        return false; // Caller should redirect to login
      }
      const freshToken = refreshData.session.access_token;
      (supabase as any).headers['Authorization'] = `Bearer ${freshToken}`;
      console.log(`[SupabaseClient] Session restored & refreshed for user: ${refreshData.session.user?.id}.`);
      return true;
    } catch (err: any) {
      console.warn('[SupabaseClient] refreshSession threw:', err.message);
      return false;
    }
  } else {
    // Clear session and remove Authorization header
    await supabase.auth.signOut();
    if ((supabase as any).headers) {
      delete (supabase as any).headers['Authorization'];
    }
    console.log("[SupabaseClient] Session cleared. Authorization header removed.");
    return true;
  }
};
