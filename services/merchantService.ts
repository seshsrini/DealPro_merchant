
import { supabase, updateSupabaseSession, supabaseAnonKey, supabaseUrl } from "./supabaseClient"; // Import supabaseUrl
import { MerchantStore, MerchantSearchStore } from "../types"; // Import MerchantSearchStore

export const merchantService = {
  // Calls Edge Function
  getMerchantStores: async (merchantId: string): Promise<MerchantStore[]> => {
    console.log(`[merchantService] Fetching stores for merchant ID: ${merchantId}`);
    // Session is handled by Edge Function's authenticateRequest
    const { data, error } = await supabase.functions.invoke('get-stores', {
      body: { merchantId },
    });
    if (error) {
      console.error("Failed to fetch merchant stores via Edge Function:", error);
      throw new Error('Unable to complete request. Please try again.');
    }
    return data as MerchantStore[];
  },

  /**
   * Searches for merchant stores by name or address.
   * @param query The search term.
   * @returns A list of matching MerchantSearchStore objects.
   */
  searchStores: async (query: string): Promise<MerchantSearchStore[]> => {
    console.log(`[merchantService] Searching stores for query: ${query}`);
    const { data, error } = await supabase.functions.invoke('search-stores', {
      body: { searchTerm: query },
    });
    if (error) {
      console.error("Failed to search stores via Edge Function:", error);
      throw new Error('Unable to complete request. Please try again.');
    }
    return data as MerchantSearchStore[];
  },

  // Update an existing store (address fields only)
  updateStore: async (merchantId: string, storeId: string, data: Record<string, unknown>): Promise<MerchantStore> => {
    const { data: res, error } = await supabase.functions.invoke('manage-stores', {
      body: { action: 'update', merchantId, storeId, data },
    });
    if (error) throw new Error('Unable to complete request. Please try again.');
    return (res as any).store as MerchantStore;
  },

  // Add a new store
  addStore: async (merchantId: string, store: Record<string, unknown>): Promise<MerchantStore> => {
    const { data: res, error } = await supabase.functions.invoke('manage-stores', {
      body: { action: 'add', merchantId, store },
    });
    if (error) throw new Error('Unable to complete request. Please try again.');
    return (res as any).store as MerchantStore;
  },

  // Delete a store
  deleteStore: async (merchantId: string, storeId: string): Promise<void> => {
    const { error } = await supabase.functions.invoke('manage-stores', {
      body: { action: 'delete', merchantId, storeId },
    });
    if (error) throw new Error('Unable to complete request. Please try again.');
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
    const FUNCTION_URL = `${supabaseUrl}/functions/v1/register-merchant`;

    try {
      console.log("[merchantService] Direct fetch for merchant registration to:", FUNCTION_URL);
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const rawBody = await response.text();
        console.error('[merchantService] Raw error body:', rawBody);
        let errorMessage = 'Registration could not be completed. Please try again.';
        try {
          const errorData = JSON.parse(rawBody);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // Keep the user-friendly default
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data || !data.user) { // session might be null if email verification is pending
        throw new Error("Registration could not be completed. Please try again.");
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
         throw new Error("Unable to connect. Please check your internet connection and try again.");
      }
      throw err; // Re-throw other specific errors from the Edge Function
    }
  },
};