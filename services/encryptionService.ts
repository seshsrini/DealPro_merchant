import CryptoJS from 'crypto-js';

/**
 * Encryption Service for Sensitive Business Data (GST, PAN)
 *
 * Security Features:
 * - AES-256 encryption
 * - Separate encryption keys for different data types
 * - Data masking for display purposes
 * - Validation before encryption
 *
 * Compliance: IT Act 2000, DPDP Act 2023
 */

// Get encryption keys from environment variables
// IMPORTANT: Never commit actual keys to git!
const BASE_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'dev-fallback-key-change-in-production';

/**
 * Validates GST format: 22AAAAA0000A1Z5 (15 characters)
 * Format: 2 digits (state code) + 10 chars (PAN) + 1 alphanumeric + Z + 1 alphanumeric
 */
const isValidGST = (gstin: string): boolean => {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gstin.toUpperCase());
};

/**
 * Validates PAN format: AAAAA9999A (10 characters)
 * Format: 5 letters + 4 digits + 1 letter
 */
const isValidPAN = (pan: string): boolean => {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
};

/**
 * Main Encryption Service
 */
export const encryptionService = {
  /**
   * Encrypts GST number with validation
   */
  encryptGST(gstin: string): { encrypted: string; isValid: boolean; error?: string } {
    try {
      const cleanGST = gstin.trim().toUpperCase();

      if (!cleanGST) {
        return { encrypted: '', isValid: false, error: 'GST number is required' };
      }

      if (!isValidGST(cleanGST)) {
        return { encrypted: '', isValid: false, error: 'Invalid GST format' };
      }

      const encrypted = CryptoJS.AES.encrypt(cleanGST, BASE_KEY + '-GST').toString();
      return { encrypted, isValid: true };
    } catch (error) {
      console.error('GST encryption failed:', error);
      return { encrypted: '', isValid: false, error: 'Encryption failed' };
    }
  },

  /**
   * Decrypts GST number
   */
  decryptGST(encryptedGST: string): string {
    try {
      if (!encryptedGST) return '';
      const bytes = CryptoJS.AES.decrypt(encryptedGST, BASE_KEY + '-GST');
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || '';
    } catch (error) {
      console.error('GST decryption failed:', error);
      return '';
    }
  },

  /**
   * Encrypts PAN number with validation
   */
  encryptPAN(pan: string): { encrypted: string; isValid: boolean; error?: string } {
    try {
      const cleanPAN = pan.trim().toUpperCase();

      if (!cleanPAN) {
        return { encrypted: '', isValid: false, error: 'PAN number is required' };
      }

      if (!isValidPAN(cleanPAN)) {
        return { encrypted: '', isValid: false, error: 'Invalid PAN format' };
      }

      const encrypted = CryptoJS.AES.encrypt(cleanPAN, BASE_KEY + '-PAN').toString();
      return { encrypted, isValid: true };
    } catch (error) {
      console.error('PAN encryption failed:', error);
      return { encrypted: '', isValid: false, error: 'Encryption failed' };
    }
  },

  /**
   * Decrypts PAN number
   */
  decryptPAN(encryptedPAN: string): string {
    try {
      if (!encryptedPAN) return '';
      const bytes = CryptoJS.AES.decrypt(encryptedPAN, BASE_KEY + '-PAN');
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted || '';
    } catch (error) {
      console.error('PAN decryption failed:', error);
      return '';
    }
  },

  /**
   * Masks GST for display: 29AAA******AAZ5
   */
  maskGST(gstin: string): string {
    if (!gstin || gstin.length !== 15) return gstin;
    return `${gstin.slice(0, 5)}******${gstin.slice(-4)}`;
  },

  /**
   * Masks PAN for display: ABC***890Z
   */
  maskPAN(pan: string): string {
    if (!pan || pan.length !== 10) return pan;
    return `${pan.slice(0, 3)}***${pan.slice(-4)}`;
  },

  /**
   * Validates GST format (exported for use in forms)
   */
  validateGST(gstin: string): boolean {
    return isValidGST(gstin.trim().toUpperCase());
  },

  /**
   * Validates PAN format (exported for use in forms)
   */
  validatePAN(pan: string): boolean {
    return isValidPAN(pan.trim().toUpperCase());
  }
};

/**
 * Audit logging service (for compliance)
 */
export const auditLogger = {
  /**
   * Logs access to sensitive data
   */
  logSensitiveDataAccess(action: string, dataType: 'GST' | 'PAN', userId?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      dataType,
      userId: userId || 'anonymous',
      userAgent: navigator.userAgent
    };

    // In production, send this to a secure logging service
    console.log('[AUDIT]', logEntry);

    // TODO: Send to backend audit log
    // await supabase.from('audit_logs').insert(logEntry);
  }
};
