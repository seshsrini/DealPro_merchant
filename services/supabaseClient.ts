
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

export const supabaseUrl = 'https://gkulyxglzqlhpqxlwjqw.supabase.co'; // Directly using your provided Supabase URL
// IMPORTANT: Replace 'YOUR_SUPABASE_ANON_KEY' with your actual Supabase Anon Key from your project settings.
// This key is used for client-side API calls to Supabase, including Edge Functions.
// Go to your Supabase project settings -> API and copy the 'anon public' key.
// >>> CRITICAL: Please REPLACE THE FOLLOWING KEY with your actual Supabase Anon Key:
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFhYmFzZSIsInJlZiI6ImdrdWx5eGdsenFsaHBxeGx3anF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjA4MjIsImV4cCI6MjA4NDQzNjgyMn0.liawuu5aYsaS6IcELQwGGzsho_ZGBTeGpAwPMCm2l7c'; 

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
    // Set the session tokens
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
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
