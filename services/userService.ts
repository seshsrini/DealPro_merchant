import { supabase, updateSupabaseSession } from "./supabaseClient";
import { ActivityLog } from "../types";

export const userService = {
  /**
   * OTP-based login for merchants.
   * 1. Calls login-merchant Edge Function to get a magic-link token_hash
   * 2. Verifies token_hash via Supabase Auth to create a session
   */
  merchantOtpLogin: async (phone: string, countryCode: string) => {
    console.log(`[userService] Attempting merchant OTP login for: ${phone}`);

    // Retry up to 2 times for transient mobile network failures
    const MAX_RETRIES = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        console.log(`[userService] Calling login-merchant (attempt ${attempt})...`);
        const { data, error } = await supabase.functions.invoke('login-merchant', {
          body: { phone, country_code: countryCode },
          headers: { 'Content-Type': 'application/json' },
        });

        console.log('[userService] Edge function response - data:', JSON.stringify(data)?.substring(0, 200));
        console.log('[userService] Edge function response - error:', error ? JSON.stringify(error) : 'null');

        if (error) {
          // Check if this is a network-level fetch failure — retry if so
          const errMsg = typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error);
          if (attempt <= MAX_RETRIES && (
            errMsg.includes('Failed to send a request') ||
            errMsg.includes('Failed to fetch') ||
            errMsg.includes('NetworkError') ||
            errMsg.includes('network')
          )) {
            console.warn(`[userService] Network error on attempt ${attempt}, retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          // On mobile, supabase.functions.invoke may return the body in error.context
          // Try to extract data from the error if function actually succeeded
          let recoveredData = null;
          try {
            if (typeof error === 'object' && error.context) {
              const text = await error.context.text?.();
              if (text) recoveredData = JSON.parse(text);
            }
          } catch (_) { /* ignore recovery attempt */ }

          if (recoveredData?.user && recoveredData?.token_hash) {
            console.log('[userService] Recovered data from error context');
            return await userService._completeLogin(recoveredData);
          }

          console.error("[userService] login-merchant Edge Function error:", error);
          throw new Error('Unable to sign in right now. Please try again.');
        }

        if (!data?.user || !data?.token_hash) {
          console.error('[userService] Missing user or token_hash in response. data keys:', data ? Object.keys(data) : 'null');
          throw new Error('No merchant account found with this phone number. Please sign up first.');
        }

        return await userService._completeLogin(data);

      } catch (err: any) {
        lastError = err;

        // Retry on network-level errors only
        if (attempt <= MAX_RETRIES && (
          err.message?.includes('Failed to send a request') ||
          err.message?.includes('Failed to fetch') ||
          err.message?.includes('NetworkError')
        )) {
          console.warn(`[userService] Fetch error on attempt ${attempt}, retrying in 2s...`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }

        // Don't retry application errors — throw immediately
        if (err.message && (
          err.message.includes('No merchant account') ||
          err.message.includes('Login failed') ||
          err.message.includes('Session creation') ||
          err.message.includes('not found') ||
          err.message.includes('Phone number') ||
          err.message.includes('Registration failed')
        )) {
          throw err;
        }

        throw new Error('Something went wrong. Please check your internet connection and try again.');
      }
    }

    // All retries exhausted
    throw new Error('Unable to connect. Please check your internet and try again.');
  },

  /** Shared helper: verify magic-link token and create session */
  _completeLogin: async (data: { user: any; token_hash: string }) => {
    console.log('[userService] Magic link token received, verifying OTP...');

    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    });

    if (otpError || !otpData?.session) {
      console.error("[userService] verifyOtp failed:", otpError);
      throw new Error('Login could not be completed. Please try again.');
    }

    await updateSupabaseSession(otpData.session);

    console.log('[userService] Merchant login successful for:', data.user.id);
    return { user: data.user, session: otpData.session };
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

      // Check for error in data first (Edge Function may return error in body)
      if (data?.error) {
        console.error("[userService] Edge Function returned error in response body:", data.error);
        throw new Error(data.error);
      }

      if (error) {
        console.error("[userService] Registration failed via Edge Function:", error);
        // Try to extract actual error message from various possible locations
        const errorMessage = error.context?.error || error.context?.message || error.message || "Registration could not be completed. Please try again.";
        throw new Error(errorMessage);
      }

      if (!data || !data.user) { // session might be null if email verification is pending
        throw new Error("Registration could not be completed. Please try again.");
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
  validateMerchantField: async (field: 'gstin' | 'pan' | 'udyam_no' | 'fssai_no' | 'trade_license_no', value: string): Promise<boolean> => {
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
      throw new Error("Unable to load your profile. Please check your connection and try again.");
    }
    
    // Check for application-level errors returned by the Edge Function itself
    if (data && data.error) {
      console.error("[userService] Edge Function returned application error during profile fetch:", data.error);
      throw new Error(data.error);
    }

    if (!data) {
      throw new Error("Could not load your profile. Please try logging in again.");
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