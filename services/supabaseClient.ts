
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

/**
 * Ensures the current session has a fresh (non-expired) JWT token.
 * Checks token expiry and proactively refreshes if it expires within 2 minutes
 * or is already expired — covers the case where the app is backgrounded long
 * enough for the auto-refresh timer to miss an expiry cycle.
 */
let _refreshPromise: Promise<string> | null = null;
export const ensureFreshToken = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getSession();
  if (!error && data.session?.access_token) {
    const expiresAt = data.session.expires_at;
    const secondsLeft = expiresAt ? expiresAt - Math.floor(Date.now() / 1000) : 0;
    if (secondsLeft > 120) {
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
        throw new Error('Session expired. Please log in again.');
      }
      console.log('[SupabaseClient] Token refreshed successfully.');
      return refreshData.session.access_token;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
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
    throw new Error('Session expired. Please log in again.');
  }

  let result = await originalInvoke(functionName, finalOptions);

  // Retry once on 401 — force refresh and try again. Handles stale-token scenarios.
  const errMsg = (result.error as any)?.message || '';
  const errCtxStatus = (result.error as any)?.context?.status;
  const isUnauthorized = errCtxStatus === 401 || /401|unauthor|invalid token|expired/i.test(errMsg);
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
