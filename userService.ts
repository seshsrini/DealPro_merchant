import { supabase, updateSupabaseSession } from "./supabaseClient";
import { ActivityLog } from "../types";

export const userService = {
  loginUser: async (identifier: string, password: string) => {
    console.log(`[userService] Attempting login for: ${identifier}`);
    
    try {
      // Added explicit headers to ensure Content-Type is set for the JSON body
      const { data, error } = await supabase.functions.invoke('login', {
        body: { identifier, password },
        headers: {
          'Content-Type': 'application/json',
        }
      });

      // If the Edge Function itself returns an error (401, 404, etc)
      if (error) {
        console.error("[userService] Edge Function returned error:", error);
        throw new Error(error.message || "Authentication failed");
      }

      if (!data?.session || !data?.user) {
        throw new Error("Invalid response structure from login service.");
      }

      // Crucial: Set the session locally so future calls are authenticated
      await updateSupabaseSession(data.session);

      return { user: data.user, session: data.session };

    } catch (err: any) {
      // This catches the "Failed to send request" network error
      console.error("[userService] Network or CORS error:", err);
      throw new Error("Connection to login service failed. Check your internet or CORS settings.");
    }
  },

  /**
   * Registers a new user via an Edge Function, creating an entry in Supabase Auth
   * and linking it to a custom profile table (consumers/merchants).
   * On success, updates the global Supabase client session.
   * @param d User registration data.
   * @returns The newly registered user's profile data and Supabase session.
   */
  registerUser: async (d: any) => {
    console.log(`[userService] Invoking 'register-user' Edge Function with payload:`, d);
    try {
      const { data, error } = await supabase.functions.invoke('register-user', {
        body: d,
      });

      if (error) {
        console.error("[userService] Registration failed via Edge Function:", error);
        throw error;
      }

      if (!data || !data.user) { // session might be null if email verification is pending
        throw new Error("Registration failed: Invalid response from registration service.");
      }

      // If a session is returned, update the client-side Supabase instance
      if (data.session) {
        await updateSupabaseSession(data.session);
      }

      return { user: data.user, session: data.session };
    } catch (error: any) {
      console.error("[userService] Registration failed:", error);
      throw error;
    }
  },

  /**
   * Validates if a user identifier (username, email, or phone) exists in the system.
   * @param identifier User's email, phone, or