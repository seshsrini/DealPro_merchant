
import { supabase } from "./supabaseClient";

export const editProfileService = {
  updateUserProfile: async (id: string, role: string, data: any) => {
    console.log(`[editProfileService] Invoking 'update-profile' for ID: ${id}`);
    
    try {
      const { data: response, error } = await supabase.functions.invoke('update-profile', {
        body: { id, role, data },
      });

      if (error) {
        console.error("[editProfileService] Edge Function error:", error);
        throw new Error(error.message || "Uplink Failed.");
      }
      
      return response;
    } catch (err: any) {
      console.error("[editProfileService] Network/Invoke Error:", err.message);
      throw new Error("Failed to reach profile server. Check connection.");
    }
  },

  resetPassword: async (identifier: string, newPassword: string) => {
    const { data: response, error } = await supabase.functions.invoke('reset-password', {
      body: { identifier, newPassword },
    });
    if (error) throw error;
    return response;
  },
};
