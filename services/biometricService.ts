import { userService } from './userService';
import { supabase } from './supabaseClient'; // Import supabase client for session mgmt

const BIOMETRIC_KEY = 'dealpro_secure_session'; // Stores identifier and (plain-text) password for re-authentication

/**
 * Interface for the Biometric Gateway.
 * In production, this would interface with @capacitor-community/native-biometric
 * and securely store credentials in Keychain/Keystore, not localStorage.
 */
export const biometricService = {
  /**
   * Checks if the hardware supports biometrics and if any are enrolled.
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Simulation for web environment, would use NativeBiometric.isAvailable()
      const hasSavedSession = !!localStorage.getItem(BIOMETRIC_KEY);
      return hasSavedSession;
    } catch (e) {
      console.error("Biometric availability check failed (simulated):", e);
      return false;
    }
  },

  /**
   * Triggers the OS-level Biometric Prompt (FaceID/Fingerprint/TouchID).
   * After successful biometric verification, it uses the saved credentials to perform a full login.
   */
  async authenticate(): Promise<any | null> {
    try {
      // In production: const result = await NativeBiometric.verify({ ... });
      // Here we simulate the process
      const savedData = localStorage.getItem(BIOMETRIC_KEY);
      if (!savedData) return null;

      const { identifier, password } = JSON.parse(savedData);
      
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate biometric auth delay

      // Use the new loginUser service which calls the Edge Function for authentication
      // Fix: Destructure `user` as `loggedInProfile` to match the `userService.loginUser` return type
      const { user: loggedInProfile, session } = await userService.loginUser(identifier, password);
      
      if (session) {
        return { ...loggedInProfile, id: session.user.id, isLoggedIn: true, role: loggedInProfile.role, access_token: session.access_token, refresh_token: session.refresh_token };
      }
      return null;
    } catch (e) {
      console.error("Biometric Authentication Protocol Failed (simulated):", e);
      return null;
    }
  },

  /**
   * Securely saves the credentials after a successful manual login.
   * In a real Capacitor app, this would use `NativeBiometric.setCredentials`.
   */
  async saveSession(identifier: string, pass: string): Promise<void> {
    const sessionData = { identifier, password: pass, timestamp: Date.now() };
    localStorage.setItem(BIOMETRIC_KEY, JSON.stringify(sessionData));
  },

  /**
   * Purges the secure session from the device.
   */
  async clearSession(): Promise<void> {
    localStorage.removeItem(BIOMETRIC_KEY);
    await supabase.auth.signOut(); // Also sign out from Supabase Auth
  }
};