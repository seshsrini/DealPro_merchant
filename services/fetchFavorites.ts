import { supabase } from "./supabaseClient";
import { Deal } from "../types"; 

export const fetchFavoritesService = {
  /**
   * Fetches user's favorite campaigns via an Edge Function.
   * The Edge Function performs the join between 'favorites' and 'user_profiles'.
   * @param userId - The user's ID
   * @param accessToken - Optional access token. If not provided, will try to get from session.
   */
  fetchFavorites: async (userId: string, accessToken?: string): Promise<Deal[]> => {
    console.log(`[fetchFavoritesService] Invoking 'get-favorites' for user: ${userId}`);

    try {
      // Use provided access token or get from session
      let token = accessToken;

      if (!token) {
        const { data: sessionData } = await supabase.auth.getSession();
        token = sessionData?.session?.access_token;
      }

      if (!token) {
        throw new Error('No active session found. Please log in again.');
      }

      const { data, error } = await supabase.functions.invoke('get-favorites', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) {
        // This catches errors returned by the Edge Function logic
        console.error("[fetchFavoritesService] Edge Function returned an error:", error);
        throw error;
      }

      console.log(`[fetchFavoritesService] Success. Received ${data?.length || 0} items.`);
      return data; // This data will now include the user_profiles object
      
    } catch (err) {
      console.error(`[fetchFavoritesService] Network or unexpected error:`, err);
      throw err;
    }
  },
};