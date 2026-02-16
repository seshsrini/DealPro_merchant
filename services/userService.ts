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

        // Check if it's an authentication error vs other errors
        const errorMsg = error.message?.toLowerCase() || '';
        const isAuthError = errorMsg.includes('invalid') ||
                           errorMsg.includes('credentials') ||
                           errorMsg.includes('password') ||
                           errorMsg.includes('unauthorized') ||
                           errorMsg.includes('authentication');

        throw new Error(isAuthError ? "Invalid username or password" : error.message);
      }

      if (!data?.session || !data?.user) {
        throw new Error("Invalid username or password");
      }

      // Crucial: Set the session locally so future calls are authenticated
      await updateSupabaseSession(data.session);

      return { user: data.user, session: data.session };

    } catch (err: any) {
      // If the error was already thrown from above (auth error), re-throw it
      if (err.message === "Invalid username or password" || err.message.includes("Invalid")) {
        throw err;
      }

      // Only network/connection errors reach here
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
   * @param identifier User's email, phone, or username.
   * @returns Promise<boolean> true if identifier exists, false otherwise.
   */
  validateUserIdentifier: async (identifier: string): Promise<boolean> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('validate-identifier', {
        body: { identifier },
      });

      if (invokeError) {
        // If the Edge Function itself returned a non-2xx status, it's an invokeError.
        // In this case, we can't definitively say if it's taken or not due to a server issue.
        // For now, let's return false and let the UI manage `null` state if needed.
        return false;
      }

      // If data is null or undefined, assume not found (isValid: false)
      return data?.isValid || false;
    } catch (e: any) {
      console.error("[userService] Identifier validation failed (client-side catch):", e);
      // Catch-all for network errors or unexpected client-side issues
      return false; // Cannot determine, assume not taken to avoid blocking if network is down
    }
  },

  /**
   * Validates if GSTIN or PAN already exists in the system.
   * @param field Either 'gstin' or 'pan'
   * @param value The GSTIN or PAN value to check
   * @returns Promise<boolean> true if value exists (taken), false otherwise.
   */
  validateMerchantField: async (field: 'gstin' | 'pan', value: string): Promise<boolean> => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('validate-merchant-field', {
        body: { field, value },
      });

      if (invokeError) {
        console.error(`[userService] ${field.toUpperCase()} validation failed:`, invokeError);
        return false;
      }

      // Returns true if the field value is taken
      return data?.isTaken || false;
    } catch (e: any) {
      console.error(`[userService] ${field.toUpperCase()} validation failed (client-side catch):`, e);
      return false;
    }
  },

  /**
   * Logs user activity via an Edge Function.
   * @param log ActivityLog object.
   */
  logActivity: async (log: ActivityLog) => {
    const { error } = await supabase.functions.invoke('log-activity', {
      body: log,
    });
    if (error) {
      console.error("[userService] Activity logging failed via Edge Function:", error);
      throw error;
    }
  },

  /**
   * Fetches a user's full profile data from the unified user_profiles table.
   * This is used for session restoration when a user is already authenticated via JWT.
   * @param userId The ID of the user from Supabase Auth.
   * @returns The user's full profile data.
   */
  getUserProfile: async (userId: string) => { // Removed 'role' parameter from client-side
    const { data, error: invokeError } = await supabase.functions.invoke('get-profile', { // Changed EF name
      body: { userId },
    });

    if (invokeError) {
      console.error("[userService] Failed to fetch user profile via Edge Function (invoke error):", invokeError);
      throw new Error(invokeError.message || "Failed to communicate with profile service.");
    }
    
    // Check for application-level errors returned by the Edge Function itself
    if (data && data.error) {
      console.error("[userService] Edge Function returned application error during profile fetch:", data.error);
      throw new Error(data.error);
    }

    if (!data) {
      throw new Error("Failed to retrieve user profile data.");
    }
    return data;
  },

  /**
   * Requests an OTP for phone number verification.
   * @param phone The phone number to send OTP to.
   */
  requestPhoneVerification: async (phone: string) => {
    const FUNCTION_URL = `https://gkulyxglzqlhpqxlwjqw.supabase.co/functions/v1/request-otp-for-profile`; // Directly using your provided Supabase URL
    
    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFhYmFzZSIsInJlZiI6ImdrdWx5eGdsenFsaHBxeGx3anF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjA4MjIsImV4cCI6MjA4NDQzNjgyMn0.liawuu5aYsaS6IcELQwGGzsho_ZGBTeGpAwPMCm2l7c', // Directly using your provided Supabase Anon Key
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFhYmFzZSIsInJlZiI6ImdrdWx5eGdsenFsaHBxeGx3anF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjA4MjIsImV4cCI6MjA4NDQzNjgyMn0.liawuu5aYsaS6IcELQwGGzsho_ZGBTeGpAwPMCm2l7c`, // Added for robust network handling
        },
        body: JSON.stringify({ phone }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          // If response is not JSON, throw a generic error with status text
          throw new Error(response.statusText || 'Unknown server error during OTP request.');
        }
        console.error("[userService] Direct fetch OTP Error:", errorData.error || response.statusText);
        throw new Error(errorData.error || response.statusText || 'Failed to send OTP');
      }

      return await response.json();
    } catch (err: any) {
      console.error("[userService] Network/CORS Error during direct OTP fetch:", err.message);
      throw err; // This error stops your popup from showing
    }
  },

  /**
   * Verifies the OTP sent to a phone number.
   * @param phone The phone number.
   * @param token The OTP code.
   */
  verifyPhoneCode: async (phone: string, token: string) => {
    const { data, error } = await supabase.functions.invoke('verify-otp-for-profile', { // Corrected function name
      body: { phone, token },
    });
    if (error) {
      console.error("[userService] Verify Phone Code failed via Edge Function:", error);
      throw error;
    }
    return data;
  },


  /**
   * Placeholder for logout logic.
   * In a real app, this would also clear client-side session state.
   */
  logoutUser: async () => {
    await supabase.auth.signOut();
    // No Edge Function needed for simple logout, as it's client-side auth state clear.
    // However, if server-side session invalidation is needed, an Edge Function could be called.
  },
};