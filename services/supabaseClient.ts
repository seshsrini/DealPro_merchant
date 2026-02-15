
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
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Updates the global Supabase client with an active session.
 * This is used after a user logs in to enable authenticated requests (e.g., for RLS).
 * @param session The Supabase Session object containing access_token and refresh_token.
 */
export const updateSupabaseSession = async (session: Session | null) => {
  if (session) {
    try {
      // Set the session tokens
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      // Log but don't throw on verification errors - session is still set
      if (error) {
        console.warn('[SupabaseClient] Session verification warning (session still set):', error.message);
      }
    } catch (err: any) {
      // Catch and log verification errors but don't block session setting
      console.warn('[SupabaseClient] Session verification failed (session still set):', err.message);
    }

    // Also update the global client's headers for direct RLS-protected table access
    // and for functions.invoke to implicitly include the Authorization header.
    (supabase as any).headers = {
      ...((supabase as any).headers || {}),
      'Authorization': `Bearer ${session.access_token}`,
    };
    console.log(`[SupabaseClient] Session updated for user: ${session.user?.id}. Authorization header set: ${session.access_token.substring(0, 30)}...`);
  } else {
    // Clear session and remove Authorization header
    await supabase.auth.signOut();
    if ((supabase as any).headers) {
      delete (supabase as any).headers['Authorization'];
    }
    console.log("[SupabaseClient] Session cleared. Authorization header removed.");
  }
};
