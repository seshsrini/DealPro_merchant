/**
 * Input Validation Utilities for Edge Functions
 * Prevents SQL injection, XSS, and validates data formats
 */

export interface ValidationRule {
  required?: string[];
  email?: string;
  phone?: string;
  minLength?: { [field: string]: number };
  maxLength?: { [field: string]: number };
  pattern?: { [field: string]: RegExp };
  custom?: { [field: string]: (value: any) => boolean };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitizedData?: any;
}

/**
 * Main validation function
 */
export function validateInput(input: any, rules: ValidationRule): ValidationResult {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid input data' };
  }

  const sanitizedData = { ...input };

  // Check required fields
  if (rules.required) {
    for (const field of rules.required) {
      if (!input[field] || (typeof input[field] === 'string' && input[field].trim() === '')) {
        return { valid: false, error: `${field} is required` };
      }
    }
  }

  // Validate email
  if (rules.email && input[rules.email]) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input[rules.email])) {
      return { valid: false, error: 'Invalid email format' };
    }
    sanitizedData[rules.email] = input[rules.email].toLowerCase().trim();
  }

  // Validate phone
  if (rules.phone && input[rules.phone]) {
    const phoneRegex = /^[0-9]{10}$/;
    const cleanPhone = input[rules.phone].replace(/\D/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return { valid: false, error: 'Invalid phone number (must be 10 digits)' };
    }
    sanitizedData[rules.phone] = cleanPhone;
  }

  // Check min length
  if (rules.minLength) {
    for (const field in rules.minLength) {
      if (input[field] && input[field].length < rules.minLength[field]) {
        return {
          valid: false,
          error: `${field} must be at least ${rules.minLength[field]} characters`
        };
      }
    }
  }

  // Check max length
  if (rules.maxLength) {
    for (const field in rules.maxLength) {
      if (input[field] && input[field].length > rules.maxLength[field]) {
        return {
          valid: false,
          error: `${field} must be at most ${rules.maxLength[field]} characters`
        };
      }
    }
  }

  // Check pattern matching
  if (rules.pattern) {
    for (const field in rules.pattern) {
      if (input[field] && !rules.pattern[field].test(input[field])) {
        return {
          valid: false,
          error: `${field} has invalid format`
        };
      }
    }
  }

  // Custom validation
  if (rules.custom) {
    for (const field in rules.custom) {
      if (input[field] && !rules.custom[field](input[field])) {
        return {
          valid: false,
          error: `${field} validation failed`
        };
      }
    }
  }

  // Sanitize all string fields (prevent XSS)
  for (const field in sanitizedData) {
    if (typeof sanitizedData[field] === 'string') {
      sanitizedData[field] = sanitizeString(sanitizedData[field]);
    }
  }

  return { valid: true, sanitizedData };
}

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(str: string): string {
  if (!str) return '';

  return str
    .trim()
    // Remove null bytes
    .replace(/\0/g, '')
    // Escape HTML special characters
    .replace(/[<>]/g, (char) => {
      const entities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;'
      };
      return entities[char] || char;
    });
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  return { valid: true };
}

/**
 * Validate username format
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters' };
  }

  if (username.length > 30) {
    return { valid: false, error: 'Username must be at most 30 characters' };
  }

  // Only allow alphanumeric, underscore, and hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username can only contain letters, numbers, underscore, and hyphen' };
  }

  return { valid: true, sanitizedData: username.toLowerCase().trim() };
}

/**
 * Validate Indian phone number
 */
export function validateIndianPhone(phone: string): ValidationResult {
  let cleanPhone = phone.replace(/\D/g, '');

  // Strip +91 / 0091 / 91 country code prefix if present (results in 12 or 13 digits)
  if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
    cleanPhone = cleanPhone.slice(2);
  } else if (cleanPhone.length === 13 && cleanPhone.startsWith('091')) {
    cleanPhone = cleanPhone.slice(3);
  }

  if (cleanPhone.length !== 10) {
    return { valid: false, error: 'Phone number must be 10 digits' };
  }

  if (!/^[6-9][0-9]{9}$/.test(cleanPhone)) {
    return { valid: false, error: 'Invalid Indian phone number' };
  }

  return { valid: true, sanitizedData: cleanPhone };
}

/**
 * Validate GST number
 */
export function validateGSTIN(gstin: string): ValidationResult {
  if (!gstin) {
    return { valid: true }; // Optional field
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstinRegex.test(gstin.toUpperCase())) {
    return { valid: false, error: 'Invalid GSTIN format' };
  }

  return { valid: true, sanitizedData: gstin.toUpperCase() };
}

/**
 * Validate PAN number
 */
export function validatePAN(pan: string): ValidationResult {
  if (!pan) {
    return { valid: true }; // Optional field
  }

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  if (!panRegex.test(pan.toUpperCase())) {
    return { valid: false, error: 'Invalid PAN format' };
  }

  return { valid: true, sanitizedData: pan.toUpperCase() };
}

/**
 * Validate Udyam (MSME) registration number
 * Format: UDYAM-XX-00-0000000 (e.g., UDYAM-MH-01-0000001)
 */
export function validateUdyam(udyam: string): ValidationResult {
  if (!udyam) {
    return { valid: true }; // Optional field
  }

  const udyamRegex = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;

  if (!udyamRegex.test(udyam.toUpperCase())) {
    return { valid: false, error: 'Invalid Udyam format. Expected: UDYAM-XX-00-0000000' };
  }

  return { valid: true, sanitizedData: udyam.toUpperCase() };
}

/**
 * Validate FSSAI food license number
 * Format: 14 digits (e.g., 11234567891234)
 */
export function validateFSSAI(fssai: string): ValidationResult {
  if (!fssai) {
    return { valid: true }; // Optional field
  }

  const fssaiRegex = /^[0-9]{14}$/;

  if (!fssaiRegex.test(fssai)) {
    return { valid: false, error: 'Invalid FSSAI format. Must be exactly 14 digits' };
  }

  return { valid: true, sanitizedData: fssai };
}

/**
 * Validate Trade License (Shop & Establishment) number
 * Format: 2-letter state code followed by alphanumeric/dash/slash (e.g., KA/2024/123456)
 */
export function validateTradeLicense(license: string): ValidationResult {
  if (!license) {
    return { valid: true }; // Optional field
  }

  const licenseRegex = /^[A-Z]{2}[A-Z0-9\/\-]{3,20}$/i;

  if (!licenseRegex.test(license.toUpperCase())) {
    return { valid: false, error: 'Invalid Trade License format. Must start with state code (e.g., KA/2024/123456)' };
  }

  return { valid: true, sanitizedData: license.toUpperCase() };
}

/**
 * Validate URL
 */
export function validateURL(url: string): ValidationResult {
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Prevent SQL injection by checking for common patterns
 */
export function checkSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|\/\*|\*\/|;)/,
    /('|(\\')|(;)|(\-\-)|(\/\*))/,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize object (deep clean)
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }

  return obj;
}
