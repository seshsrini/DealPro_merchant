# DealPro Security Audit & Remediation Guide

## Current Status
Last Updated: 2026-02-14

---

## 1. NPM Package Vulnerabilities

### Current Issues
- **5 vulnerabilities found** (1 low, 4 high)
- `tar` package: Multiple high severity issues
- `undici` package: Multiple high severity issues

### Immediate Actions

```bash
# 1. Check current vulnerabilities
npm audit

# 2. Try automatic fixes (safe updates)
npm audit fix

# 3. For breaking changes (review carefully before running)
npm audit fix --force

# 4. Update all packages to latest compatible versions
npm update

# 5. Update specific vulnerable packages manually
npm install tar@latest
npm install undici@latest

# 6. Verify fixes
npm audit
```

### Best Practices
- Run `npm audit` before every deployment
- Set up automated security scanning in CI/CD pipeline
- Use `npm ci` in production instead of `npm install`
- Keep `package-lock.json` in version control

---

## 2. Frontend Security (React/TypeScript)

### ✅ Already Implemented
- User input sanitization in forms
- HTTPS-only communication with Supabase
- Secure session management
- XSS protection via React's default escaping

### 🔧 Required Fixes

#### A. Secure Local Storage
**Issue:** Sensitive data in localStorage can be accessed by XSS attacks

```typescript
// ❌ BAD - Don't store sensitive data in plain text
localStorage.setItem('user_password', password);
localStorage.setItem('access_token', token);

// ✅ GOOD - Store only non-sensitive data, use httpOnly cookies for tokens
// Move tokens to Supabase session management (already doing this!)
```

**Action:** Audit all `localStorage.setItem()` calls:
```bash
grep -r "localStorage.setItem" --include="*.tsx" --include="*.ts"
```

#### B. Input Validation
**Current:** Basic validation exists
**Needed:** Add comprehensive validation

```typescript
// Add to all form inputs
const sanitizeInput = (input: string) => {
  return input.trim().replace(/[<>]/g, '');
};

// Validate email format
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Validate phone numbers
const isValidPhone = (phone: string) => /^[0-9]{10}$/.test(phone);
```

#### C. Content Security Policy (CSP)
**Add to index.html:**
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
           script-src 'self' 'unsafe-inline' 'unsafe-eval';
           style-src 'self' 'unsafe-inline';
           img-src 'self' data: https:;
           connect-src 'self' https://*.supabase.co;">
```

---

## 3. Backend Security (Supabase Edge Functions)

### 🔧 Critical Issues to Fix

#### A. SQL Injection Prevention
**Location:** All Supabase queries

```typescript
// ❌ BAD - Vulnerable to SQL injection
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('username', userInput); // If userInput is not sanitized

// ✅ GOOD - Use parameterized queries (Supabase does this by default)
// Always validate/sanitize input first
const sanitizedUsername = userInput.trim().toLowerCase();
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('username', sanitizedUsername);
```

**Action Required:**
1. Review all Edge Functions for user input handling
2. Add input validation at the start of every function
3. Use TypeScript types to enforce data structure

#### B. Authentication & Authorization

**Files to audit:**
- `supabase/functions/login/index.ts`
- `supabase/functions/register-user/index.ts`
- `supabase/functions/register-merchant/index.ts`

**Required checks:**
```typescript
// Always verify user is authenticated
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Verify JWT token
const token = authHeader.replace('Bearer ', '');
const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return new Response(JSON.stringify({ error: 'Invalid token' }), {
    status: 401
  });
}

// Verify user has permission for the action
if (user.role !== 'merchant' && action === 'create_deal') {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403
  });
}
```

#### C. Rate Limiting
**Add to all public-facing Edge Functions:**

```typescript
// Simple in-memory rate limiter
const rateLimits = new Map<string, number[]>();

function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const userRequests = rateLimits.get(identifier) || [];

  // Remove old requests outside the window
  const recentRequests = userRequests.filter(time => now - time < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }

  recentRequests.push(now);
  rateLimits.set(identifier, recentRequests);
  return true;
}

// Use in Edge Functions
if (!checkRateLimit(req.headers.get('x-forwarded-for') || 'unknown')) {
  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429
  });
}
```

---

## 4. Database Security (Supabase/PostgreSQL)

### 🔧 Row Level Security (RLS) Policies

**Critical:** Enable RLS on ALL tables

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_deals ENABLE ROW LEVEL SECURITY;

-- Example: Users can only read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Example: Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Example: Only merchants can create campaigns
CREATE POLICY "Merchants can create campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'merchant'
    )
  );

-- Example: Merchants can only edit their own campaigns
CREATE POLICY "Merchants can edit own campaigns"
  ON campaigns FOR UPDATE
  USING (merchant_id = auth.uid());

-- Example: All authenticated users can view active campaigns
CREATE POLICY "View active campaigns"
  ON campaigns FOR SELECT
  USING (status = 'active');
```

### Sensitive Data Encryption

**Files to check:**
- Bank account numbers
- PAN cards
- GSTIN
- Phone numbers
- Addresses

```sql
-- Use pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive fields
ALTER TABLE user_profiles
  ADD COLUMN account_number_encrypted bytea;

-- Encrypt on insert
INSERT INTO user_profiles (account_number_encrypted)
VALUES (pgp_sym_encrypt('account_number_here', 'encryption_key'));

-- Decrypt on read (only in Edge Functions, never send to client)
SELECT pgp_sym_decrypt(account_number_encrypted, 'encryption_key')::text
FROM user_profiles WHERE id = auth.uid();
```

**Store encryption keys in Supabase secrets:**
```bash
# Set in Supabase dashboard under Project Settings > API
# Add custom environment variable: ENCRYPTION_KEY
```

---

## 5. Android App Security

### A. Network Security Config

**Create:** `android/app/src/main/res/xml/network_security_config.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Only allow HTTPS connections -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <!-- Only trust specific domains -->
    <domain-config>
        <domain includeSubdomains="true">supabase.co</domain>
        <domain includeSubdomains="true">your-project.supabase.co</domain>
    </domain-config>
</network-security-config>
```

**Update:** `android/app/src/main/AndroidManifest.xml`
```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ...>
```

### B. ProGuard/R8 Configuration

**Enable code obfuscation in:** `android/app/build.gradle`

```gradle
android {
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Create:** `android/app/proguard-rules.pro`
```
# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }

# Keep your app classes
-keep class com.dealpro.** { *; }

# Remove logging in production
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
```

### C. Secure Storage

**Use Capacitor SecureStorage for sensitive data:**

```bash
npm install @capacitor-community/secure-storage
```

```typescript
import { SecureStorage } from '@capacitor-community/secure-storage';

// Store sensitive data
await SecureStorage.set({ key: 'user_token', value: token });

// Retrieve
const { value } = await SecureStorage.get({ key: 'user_token' });

// Remove
await SecureStorage.remove({ key: 'user_token' });
```

---

## 6. API Security Checklist

### Headers to Add

```typescript
// In all Edge Functions
const headers = {
  'Content-Type': 'application/json',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'no-referrer'
};
```

### CORS Configuration

```typescript
// Only allow your app's origin
const allowedOrigins = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost:8100', // Dev only
  'https://your-domain.com'
];

const origin = req.headers.get('Origin');
if (allowedOrigins.includes(origin)) {
  headers['Access-Control-Allow-Origin'] = origin;
}
```

---

## 7. Authentication Security

### ✅ Current Implementation
- Supabase Auth (secure by default)
- Session management
- JWT tokens

### 🔧 Enhancements Needed

#### A. Password Policy

```typescript
// Add to registration
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain a number' };
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return { valid: false, error: 'Password must contain special character' };
  }
  return { valid: true };
}
```

#### B. Account Lockout

```sql
-- Add to user_profiles table
ALTER TABLE user_profiles
  ADD COLUMN failed_login_attempts INTEGER DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMP;

-- Lock account after 5 failed attempts
-- Implement in login Edge Function
```

#### C. Two-Factor Authentication (2FA)

```typescript
// Add to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN two_factor_secret TEXT;

// Use OTP library for 2FA
npm install otplib qrcode
```

---

## 8. File Upload Security

**If you handle file uploads:**

```typescript
// Validate file type
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
if (!allowedTypes.includes(file.type)) {
  throw new Error('Invalid file type');
}

// Validate file size (5MB max)
if (file.size > 5 * 1024 * 1024) {
  throw new Error('File too large');
}

// Sanitize filename
const sanitizedName = file.name
  .replace(/[^a-zA-Z0-9.-]/g, '_')
  .toLowerCase();

// Use Supabase Storage with RLS policies
const { data, error } = await supabase
  .storage
  .from('campaign-images')
  .upload(sanitizedName, file, {
    cacheControl: '3600',
    upsert: false
  });
```

---

## 9. Logging & Monitoring

### Setup Error Tracking

```bash
# Install Sentry for error tracking
npm install @sentry/react @sentry/capacitor
```

```typescript
// Initialize in App.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  environment: process.env.NODE_ENV,
  beforeSend(event, hint) {
    // Don't send sensitive data
    if (event.request?.data) {
      delete event.request.data.password;
      delete event.request.data.token;
    }
    return event;
  }
});
```

### Audit Logging

```sql
-- Create audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create trigger for sensitive tables
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to sensitive tables
CREATE TRIGGER audit_user_profiles
AFTER UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

## 10. Security Testing

### Automated Scanning

```bash
# 1. NPM vulnerabilities
npm audit

# 2. Dependency check
npm install -g snyk
snyk test
snyk monitor

# 3. Code scanning
npm install -g eslint-plugin-security
```

### Manual Testing Checklist

- [ ] SQL Injection testing on all inputs
- [ ] XSS testing on text fields
- [ ] CSRF protection verification
- [ ] Session hijacking tests
- [ ] Broken authentication tests
- [ ] Sensitive data exposure checks
- [ ] Security misconfiguration review
- [ ] Broken access control tests
- [ ] Using components with known vulnerabilities check
- [ ] Insufficient logging & monitoring review

---

## 11. Deployment Security

### Environment Variables

```bash
# Never commit these files
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
echo "google-services.json" >> .gitignore
```

**Create:** `.env.example` (commit this)
```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Production Checklist

- [ ] Remove all `console.log()` statements
- [ ] Enable ProGuard/R8 obfuscation
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS only
- [ ] Set up CSP headers
- [ ] Enable rate limiting
- [ ] Set up monitoring/alerting
- [ ] Review all RLS policies
- [ ] Conduct security audit
- [ ] Penetration testing

---

## 12. Compliance

### GDPR Compliance

- [ ] Privacy Policy implementation ✅
- [ ] Terms of Service implementation ✅
- [ ] Cookie consent (if using cookies)
- [ ] Data export functionality
- [ ] Data deletion functionality
- [ ] User consent for data processing

### Data Retention

```sql
-- Auto-delete old data
CREATE OR REPLACE FUNCTION delete_old_activity_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron
SELECT cron.schedule('delete-old-logs', '0 0 * * *', 'SELECT delete_old_activity_logs()');
```

---

## Priority Action Plan

### 🔴 Critical (Do Immediately)
1. Run `npm audit fix` to fix package vulnerabilities
2. Enable RLS on all database tables
3. Add input validation to all Edge Functions
4. Review and sanitize all user inputs
5. Enable HTTPS-only in Android app

### 🟡 High Priority (This Week)
1. Implement rate limiting on public APIs
2. Add proper error handling (don't expose stack traces)
3. Set up security headers in Edge Functions
4. Audit all localStorage usage
5. Enable code obfuscation for Android

### 🟢 Medium Priority (This Month)
1. Set up Sentry error tracking
2. Implement audit logging
3. Add 2FA support
4. Conduct security testing
5. Set up automated security scanning in CI/CD

### 🔵 Low Priority (Ongoing)
1. Regular dependency updates
2. Security training for team
3. Penetration testing
4. Compliance audits
5. Documentation updates

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [React Security Best Practices](https://react.dev/learn/security)
- [Android Security Tips](https://developer.android.com/training/articles/security-tips)
- [NPM Security Best Practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)

---

**Last Review:** 2026-02-14
**Next Review Due:** 2026-03-14
**Reviewer:** Development Team
