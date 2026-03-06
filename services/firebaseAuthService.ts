
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { initializeApp, getApps } from 'firebase/app';

// Firebase credentials loaded from environment variables
const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || '';
const FIREBASE_REST_BASE = 'https://identitytoolkit.googleapis.com/v1';

// Initialize Firebase web SDK (needed for @capacitor-firebase/authentication on web)
// Must match android/app/google-services.json (project: dealpro-merchant)
if (getApps().length === 0) {
  initializeApp({
    apiKey: FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  });
  console.log('[FirebaseAuth] Firebase web SDK initialized');
}

/**
 * Firebase Auth service for Phone OTP and Email verification.
 * Uses Firebase only for verification — main authentication stays on Supabase.
 *
 * Phone OTP: Uses Capacitor Firebase Auth plugin (native Android).
 * Email verification: Uses Firebase REST API to send verification links.
 */
class FirebaseAuthService {
  private verificationId: string | null = null;
  private emailIdToken: string | null = null;

  /**
   * Send OTP to the given phone number.
   * @param phoneNumber Full phone number with country code, e.g. "+919876543210"
   */
  async sendOtp(phoneNumber: string): Promise<void> {
    console.log('[FirebaseAuth] Sending OTP to:', phoneNumber);

    try {
      // Set up listeners BEFORE triggering signInWithPhoneNumber.
      // On Android, the verificationId arrives asynchronously via phoneCodeSent event.
      const verificationId = await new Promise<string>(async (resolve, reject) => {
        // Timeout after 60 seconds
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('OTP request timed out. Please try again.'));
        }, 60000);

        const cleanup = () => {
          clearTimeout(timeout);
          codeSentHandle?.remove();
          failedHandle?.remove();
          completedHandle?.remove();
        };

        // Listen for code sent (SMS dispatched)
        const codeSentHandle = await FirebaseAuthentication.addListener(
          'phoneCodeSent',
          (event) => {
            console.log('[FirebaseAuth] phoneCodeSent event received, verificationId:', event.verificationId?.substring(0, 10) + '...');
            cleanup();
            if (event.verificationId) {
              resolve(event.verificationId);
            } else {
              reject(new Error('Failed to get verification ID from Firebase.'));
            }
          }
        );

        // Listen for verification failed
        const failedHandle = await FirebaseAuthentication.addListener(
          'phoneVerificationFailed',
          (event) => {
            console.error('[FirebaseAuth] phoneVerificationFailed event:', event.message);
            cleanup();
            reject(new Error('Phone verification failed.'));
          }
        );

        // Listen for auto-verification (e.g. instant verification on same device)
        const completedHandle = await FirebaseAuthentication.addListener(
          'phoneVerificationCompleted',
          (event) => {
            console.log('[FirebaseAuth] phoneVerificationCompleted event (auto-verified)');
            cleanup();
            // Auto-verified — no code needed, resolve with a sentinel value
            resolve('__AUTO_VERIFIED__');
          }
        );

        // Now trigger the phone verification
        try {
          await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber });
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      if (verificationId === '__AUTO_VERIFIED__') {
        // Phone was auto-verified (e.g. instant verification).
        // The user doesn't need to enter an OTP code.
        this.verificationId = '__AUTO_VERIFIED__';
        console.log('[FirebaseAuth] Phone auto-verified — no OTP code needed.');
      } else {
        this.verificationId = verificationId;
        console.log('[FirebaseAuth] OTP sent successfully. Verification ID received.');
      }
    } catch (error: any) {
      console.error('[FirebaseAuth] Error sending OTP:', error);

      // Provide user-friendly error messages
      if (error.message?.includes('TOO_MANY_ATTEMPTS') || error.message?.includes('too-many-requests')) {
        throw new Error('Too many OTP attempts. Please try again later.');
      }
      if (error.message?.includes('INVALID_PHONE_NUMBER') || error.message?.includes('invalid-phone-number')) {
        throw new Error('Invalid phone number. Please check and try again.');
      }
      if (error.message?.includes('quota')) {
        throw new Error('SMS quota exceeded. Please try again later.');
      }

      throw new Error('Failed to send OTP. Please try again.');
    }
  }

  /**
   * Verify the OTP code entered by the user.
   * @param otpCode The 6-digit OTP code
   * @returns true if verification succeeded
   */
  async verifyOtp(otpCode: string): Promise<boolean> {
    console.log('[FirebaseAuth] Verifying OTP...');

    if (!this.verificationId) {
      throw new Error('No OTP was sent. Please request a new OTP.');
    }

    // If phone was auto-verified, no code check needed
    if (this.verificationId === '__AUTO_VERIFIED__') {
      console.log('[FirebaseAuth] Phone was auto-verified, skipping code confirmation.');
      await this.signOutFirebase();
      return true;
    }

    try {
      await FirebaseAuthentication.confirmVerificationCode({
        verificationId: this.verificationId,
        verificationCode: otpCode,
      });

      console.log('[FirebaseAuth] OTP verified successfully!');

      // Sign out from Firebase immediately — we only use Firebase for OTP,
      // not for session management. Supabase handles auth.
      await this.signOutFirebase();

      return true;
    } catch (error: any) {
      console.error('[FirebaseAuth] OTP verification failed:', error);

      if (error.message?.includes('INVALID_VERIFICATION_CODE') || error.message?.includes('invalid-verification-code')) {
        throw new Error('Invalid OTP. Please check and try again.');
      }
      if (error.message?.includes('SESSION_EXPIRED') || error.message?.includes('session-expired')) {
        this.verificationId = null;
        throw new Error('OTP expired. Please request a new one.');
      }

      throw new Error('OTP verification failed. Please try again.');
    }
  }

  // ─── EMAIL VERIFICATION (Firebase REST API) ───

  /**
   * Send an email verification link to the given email address.
   * Creates a temporary Firebase user, sends verification email, stores idToken.
   * @param email The email address to verify
   */
  async sendEmailVerification(email: string): Promise<void> {
    console.log('[FirebaseAuth] Sending email verification to:', email);

    try {
      let idToken: string;
      let refreshToken: string | undefined;
      // Deterministic password so we can always sign back in to recover stale users
      const tempPassword = `DPv!${email.toLowerCase().replace(/[^a-z0-9]/g, '')}X9`;
      const rtKey = `dp_email_verify_rt_${email.toLowerCase()}`;

      // Try to create a temporary Firebase user
      const signUpRes = await fetch(`${FIREBASE_REST_BASE}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: tempPassword, returnSecureToken: true }),
      });

      let signUpData = await signUpRes.json();

      if (signUpData.error && signUpData.error.message === 'EMAIL_EXISTS') {
        console.log('[FirebaseAuth] Email exists in Firebase, signing in with deterministic password...');

        // Sign in with the deterministic password to get an idToken
        const signInRes = await fetch(`${FIREBASE_REST_BASE}/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: tempPassword, returnSecureToken: true }),
        });
        const signInData = await signInRes.json();

        if (signInData.idToken) {
          // Successfully signed in — delete old user and recreate
          console.log('[FirebaseAuth] Signed in to stale user, deleting and recreating...');
          await fetch(`${FIREBASE_REST_BASE}/accounts:delete?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: signInData.idToken }),
          });
          localStorage.removeItem(rtKey);

          // Recreate
          const retryRes = await fetch(`${FIREBASE_REST_BASE}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: tempPassword, returnSecureToken: true }),
          });
          signUpData = await retryRes.json();
          if (signUpData.error) {
            throw new Error('Failed to initiate email verification.');
          }
        } else {
          // Can't sign in (maybe old password was random) — try stored refresh token
          const oldRefreshToken = localStorage.getItem(rtKey);
          if (oldRefreshToken) {
            try {
              const tokenRes = await fetch(
                `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(oldRefreshToken)}`,
                }
              );
              const tokenData = await tokenRes.json();
              if (tokenData.id_token) {
                // Resend verification with existing token
                const verifyRes = await fetch(`${FIREBASE_REST_BASE}/accounts:sendOobCode?key=${FIREBASE_API_KEY}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken: tokenData.id_token }),
                });
                if (!(await verifyRes.json()).error) {
                  console.log('[FirebaseAuth] Verification email resent using stored token.');
                  this.emailIdToken = tokenData.id_token;
                  localStorage.setItem(rtKey, tokenData.refresh_token || oldRefreshToken);
                  return;
                }
                // Delete and retry
                await fetch(`${FIREBASE_REST_BASE}/accounts:delete?key=${FIREBASE_API_KEY}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken: tokenData.id_token }),
                });
                localStorage.removeItem(rtKey);
                const retryRes = await fetch(`${FIREBASE_REST_BASE}/accounts:signUp?key=${FIREBASE_API_KEY}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password: tempPassword, returnSecureToken: true }),
                });
                signUpData = await retryRes.json();
                if (signUpData.error) {
                  throw new Error('Failed to initiate email verification.');
                }
              }
            } catch (e) {
              console.warn('[FirebaseAuth] Refresh token recovery failed:', e);
              throw new Error('Unable to send verification email. Please try again later.');
            }
          } else {
            throw new Error('Unable to send verification email. Please try again later.');
          }
        }
      } else if (signUpData.error) {
        throw new Error('Failed to initiate email verification.');
      }

      idToken = signUpData.idToken;
      refreshToken = signUpData.refreshToken;
      this.emailIdToken = idToken;

      // Persist refreshToken for later verification checks
      if (refreshToken) {
        try {
          localStorage.setItem(rtKey, refreshToken);
        } catch (e) {
          console.warn('[FirebaseAuth] Could not persist refresh token:', e);
        }
      }
      console.log('[FirebaseAuth] Temporary Firebase user created for email verification.');

      // Send verification email
      const verifyRes = await fetch(`${FIREBASE_REST_BASE}/accounts:sendOobCode?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'VERIFY_EMAIL', idToken }),
      });

      const verifyData = await verifyRes.json();

      if (verifyData.error) {
        throw new Error('Failed to send verification email.');
      }

      console.log('[FirebaseAuth] Verification email sent successfully to:', email);
    } catch (error: any) {
      console.error('[FirebaseAuth] Email verification error:', error);

      if (error.message?.includes('TOO_MANY_ATTEMPTS') || error.message?.includes('too-many-requests')) {
        throw new Error('Too many attempts. Please try again later.');
      }

      throw new Error('Failed to send verification email.');
    }
  }

  /**
   * Check if the email has been verified (user clicked the link).
   * @param email The email to check
   * @returns true if verified
   */
  async checkEmailVerified(): Promise<boolean> {
    if (!this.emailIdToken) {
      console.warn('[FirebaseAuth] No email verification in progress.');
      return false;
    }

    try {
      // Lookup user data using the stored idToken
      const res = await fetch(`${FIREBASE_REST_BASE}/accounts:lookup?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: this.emailIdToken }),
      });

      const data = await res.json();

      if (data.error) {
        console.error('[FirebaseAuth] Email verification check failed:', data.error.message);
        return false;
      }

      const user = data.users?.[0];
      if (user?.emailVerified) {
        console.log('[FirebaseAuth] Email verified!');
        // Cleanup: delete the temporary Firebase user
        await this.deleteFirebaseEmailUser();
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('[FirebaseAuth] Error checking email verification:', error);
      return false;
    }
  }

  /**
   * Delete the temporary Firebase user created for email verification.
   */
  private async deleteFirebaseEmailUser(): Promise<void> {
    if (!this.emailIdToken) return;
    try {
      await fetch(`${FIREBASE_REST_BASE}/accounts:delete?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: this.emailIdToken }),
      });
      console.log('[FirebaseAuth] Temporary email verification user deleted.');
      this.emailIdToken = null;
    } catch (error) {
      console.warn('[FirebaseAuth] Failed to delete temp email user:', error);
    }
  }

  /**
   * Check if email is verified using a stored refresh token (for login-time checks).
   * Returns true if verified, false otherwise. Cleans up Firebase temp user if verified.
   */
  async checkEmailVerifiedByToken(email: string): Promise<boolean> {
    const key = `dp_email_verify_rt_${email.toLowerCase()}`;
    const refreshToken = localStorage.getItem(key);
    if (!refreshToken) {
      console.log('[FirebaseAuth] No stored refresh token for:', email);
      return false;
    }

    try {
      // Exchange refresh token for a fresh idToken
      const tokenRes = await fetch(
        `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
        }
      );
      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        console.warn('[FirebaseAuth] Refresh token exchange failed:', tokenData.error.message);
        localStorage.removeItem(key);
        return false;
      }

      const freshIdToken = tokenData.id_token;

      // Check emailVerified status
      const lookupRes = await fetch(`${FIREBASE_REST_BASE}/accounts:lookup?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: freshIdToken }),
      });
      const lookupData = await lookupRes.json();
      const user = lookupData.users?.[0];

      if (user?.emailVerified) {
        console.log('[FirebaseAuth] Email verified for:', email);
        // Clean up: delete temp Firebase user and remove stored token
        await fetch(`${FIREBASE_REST_BASE}/accounts:delete?key=${FIREBASE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: freshIdToken }),
        });
        localStorage.removeItem(key);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('[FirebaseAuth] Error checking email verification by token:', error);
      return false;
    }
  }

  /**
   * Sign out from Firebase (cleanup after OTP verification).
   */
  private async signOutFirebase(): Promise<void> {
    try {
      await FirebaseAuthentication.signOut();
      console.log('[FirebaseAuth] Signed out from Firebase (post-OTP cleanup).');
    } catch (error) {
      // Non-critical — just cleanup
      console.warn('[FirebaseAuth] Error signing out from Firebase:', error);
    }
  }

  /**
   * Check if the phone was auto-verified (instant verification on same device).
   */
  isAutoVerified(): boolean {
    return this.verificationId === '__AUTO_VERIFIED__';
  }

  /**
   * Check if Firebase Phone Auth is available on this platform.
   */
  isAvailable(): boolean {
    return Capacitor.getPlatform() !== 'web';
  }

  /**
   * Reset state (e.g., when modal closes).
   */
  reset(): void {
    this.verificationId = null;
    this.emailIdToken = null;
  }
}

export const firebaseAuthService = new FirebaseAuthService();
