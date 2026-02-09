
import { supabase, updateSupabaseSession, supabaseAnonKey } from "./supabaseClient"; // Import supabaseAnonKey
import { MerchantStore } from "../types";

export const merchantService = {
  // Calls Edge Function
  getMerchantStores: async (merchantId: string): Promise<MerchantStore[]> => {
    console.log(`[merchantService] Fetching stores for merchant ID: ${merchantId}`);
    const { data, error } = await supabase.functions.invoke('get-stores', {
      body: { merchantId },
    });
    if (error) {
      console.error("Failed to fetch merchant stores via Edge Function:", error);
      throw error; // Propagate error
    }
    return data as MerchantStore[];
  },

  /**
   * Registers a new merchant user via a dedicated Edge Function, creating an entry in Supabase Auth
   * and linking it to the 'merchants' custom profile table and 'merchant_stores' table.
   * On success, updates the global Supabase client session.
   * @param payload Merchant registration data.
   * @returns The newly registered merchant's profile data and Supabase session.
   */
  registerMerchant: async (payload: any) => {
    // CRITICAL: Ensure the Edge Function is deployed at this exact path on your Supabase instance.
    const FUNCTION_URL = `https://gkulyxglzqlhpqxlwjqw.supabase.co/functions/v1/register-merchant`; // Corrected FUNCTION_URL
    
    try {
      console.log("[merchantService] Direct fetch for merchant registration to:", FUNCTION_URL);
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey, // Use the imported anon key
          'Authorization': `Bearer ${supabaseAnonKey}`, // Also send anon key as bearer for some edge cases
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          // If the Edge Function returns an application-level error (e.g., duplicate username)
          throw new Error(errorData.error || errorData.message || `Server error: ${response.status} ${response.statusText}`);
        } catch (jsonError) {
          // If response is not JSON or other parsing error
          throw new Error(`Registration failed: ${response.status} ${response.statusText || 'Unknown error'}.`);
        }
      }

      const data = await response.json();

      if (!data || !data.user) { // session might be null if email verification is pending
        throw new Error("Merchant registration failed: Invalid response from registration service.");
      }

      // If a session is returned, update the client-side Supabase instance
      if (data.session) {
        await updateSupabaseSession(data.session);
      }

      return { user: data.user, session: data.session };
    } catch (err: any) {
      console.error("[merchantService] Merchant registration failed (Direct Fetch):", err);
      // Provide a more generic network error for CORS/network issues
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
         throw new Error("Could not connect to registration service. Please open the app in a new window or check your internet connection.");
      }
      throw err; // Re-throw other specific errors from the Edge Function
    }
  },
};