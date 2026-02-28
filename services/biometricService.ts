import { supabase } from './supabaseClient';

const USER_KEY = 'dealpro_merchant_session';

/**
 * Session persistence service for merchant app.
 * Saves the full user object (including tokens) to localStorage.
 * On app reopen, restores the user directly — no network calls needed.
 */
export const biometricService = {
  async saveSession(user: any): Promise<void> {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  getSavedUser(): any | null {
    try {
      const saved = localStorage.getItem(USER_KEY);
      if (!saved) return null;
      const user = JSON.parse(saved);
      if (!user || !user.id || !user.isLoggedIn) return null;
      return user;
    } catch {
      return null;
    }
  },

  async clearSession(): Promise<void> {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('dealpro_merchant_biometric_asked');
    await supabase.auth.signOut();
  },
};