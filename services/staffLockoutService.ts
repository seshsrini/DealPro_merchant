import { supabase } from './supabaseClient';

/**
 * Staff lockout guard. Asks the backend whether the current user may still act
 * (manage-staff → session_check → merchant_is_active_actor). Returns false ONLY
 * when the server explicitly says the staff member is disabled — every transient
 * / network error fails OPEN (returns true) so a glitch never logs a real
 * merchant out. The hard security guarantee is the per-request gate on the edge
 * functions; this poll is what promptly ejects a disabled staff member's app.
 */
export const staffLockoutService = {
  async isActive(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'session_check' },
      });
      if (error) return true; // fail-open on transient/edge errors
      return (data as any)?.active !== false;
    } catch {
      return true;
    }
  },
};
