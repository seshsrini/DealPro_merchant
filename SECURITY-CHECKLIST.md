# Security Checklist for DealPro APK Build

This document outlines critical security steps to complete before building and publishing your APK.

## 🔴 CRITICAL - Must Complete Before APK Upload

### 1. Google Maps API Key Protection

**Status:** ✅ Now using environment variables

**Actions Required:**

1. **Restrict API Key in Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Select your Google Maps API key
   - Add **Application Restrictions**:
     - Type: `Android apps`
     - Package name: `com.dealpro.app` (or your actual package name)
     - SHA-1 certificate fingerprint: Get from your keystore
   - Add **API Restrictions**:
     - Only allow: `Maps JavaScript API`, `Places API`, `Geocoding API`
   - Save changes

2. **Get SHA-1 Fingerprint:**
   ```bash
   # For debug keystore:
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

   # For release keystore:
   keytool -list -v -keystore /path/to/your/release.keystore -alias your-alias
   ```

3. **Verify in .env.local:**
   - Ensure `VITE_GOOGLE_MAPS_API_KEY` is set
   - Never commit this file to git

### 2. Supabase Security

**Status:** ✅ Now using environment variables

**Actions Required:**

1. **Enable Row Level Security (RLS) on ALL tables:**
   ```sql
   -- Run in Supabase SQL Editor for EVERY table:
   ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
   ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;
   -- ... repeat for all tables
   ```

2. **Create RLS Policies:**
   - Users should only see their own data
   - Merchants should only access their own campaigns
   - Example policy:
     ```sql
     CREATE POLICY "Users can view own data" ON users
     FOR SELECT USING (auth.uid() = id);
     ```

3. **Verify Anon Key Only:**
   - Check `services/supabaseClient.ts` uses `VITE_SUPABASE_ANON_KEY`
   - Never use service role key in client code

### 3. Environment Variables

**Status:** ✅ Configured

**Verify:**
- [ ] `.env.local` exists and contains all keys
- [ ] `.env.local` is in `.gitignore`
- [ ] `.env.example` exists for team reference
- [ ] No hardcoded API keys in source code

**Environment Variables Required:**
```bash
VITE_GEMINI_API_KEY=your_key_here
VITE_GOOGLE_MAPS_API_KEY=your_key_here
VITE_SUPABASE_URL=your_url_here
VITE_SUPABASE_ANON_KEY=your_key_here
```

### 4. Input Validation

**Status:** ✅ Enhanced in QRscan component

**Implemented:**
- JSON payload validation with allowed keys whitelist
- Type checking for campaign_id and merchant_id
- Protection against injection attacks
- Merchant authorization verification

**Verify:**
- [ ] All user inputs are validated
- [ ] No direct SQL queries with user input
- [ ] All Edge Functions validate inputs server-side

### 5. Secure Data Storage

**Current:** Using localStorage (not encrypted)

**Recommendations:**
```typescript
// Install Capacitor Secure Storage
npm install @capacitor/preferences

// Use for sensitive data:
import { Preferences } from '@capacitor/preferences';

await Preferences.set({
  key: 'user_token',
  value: token
});
```

**Update Needed:**
- [ ] Replace localStorage for auth tokens with Preferences API
- [ ] Keep localStorage only for non-sensitive cache data

## 🟡 IMPORTANT - Best Practices

### 6. Code Obfuscation

**Action Required:**
Enable ProGuard/R8 in Android build:

```gradle
// android/app/build.gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 7. HTTPS Enforcement

**Verify:**
- [ ] All Supabase calls use HTTPS (check supabaseUrl)
- [ ] All external API calls use HTTPS
- [ ] No mixed content warnings

### 8. Permission Declarations

**Verify in android/app/src/main/AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

Only include permissions you actually use!

### 9. Dependency Audit

**Run Before Each Build:**
```bash
npm audit
npm audit fix
```

**Check for:**
- [ ] No critical vulnerabilities
- [ ] All dependencies up to date
- [ ] No unused dependencies

### 10. Console Logging

**For Production:**
```typescript
// Add to vite.config.ts for production builds:
define: {
  'console.log': 'void',
  'console.debug': 'void',
  'console.info': 'void'
}
```

**Important:** Keep `console.error` and `console.warn` for debugging production issues.

## 🟢 OPTIONAL - Advanced Security

### 11. Certificate Pinning

Consider implementing SSL certificate pinning for Supabase connections:

```typescript
// Using @capacitor-community/http
import { Http } from '@capacitor-community/http';
```

### 12. Biometric Authentication

Already implemented? Verify:
- [ ] Biometric data never leaves device
- [ ] Fallback to PIN/password available
- [ ] Works on both Android/iOS

### 13. Rate Limiting

**Edge Functions:**
Implement rate limiting in Supabase Edge Functions:
```typescript
// Check request frequency per user
const rateLimit = await checkRateLimit(userId);
if (rateLimit.exceeded) {
  return new Response('Too many requests', { status: 429 });
}
```

## Pre-Build Checklist

Before running `npm run build` or `ionic cap build`:

- [ ] All environment variables set in `.env.local`
- [ ] Google Maps API key restricted in Cloud Console
- [ ] Supabase RLS enabled on all tables
- [ ] No hardcoded secrets in code
- [ ] `.gitignore` includes `.env.local`
- [ ] `npm audit` shows no critical issues
- [ ] ProGuard enabled for release builds
- [ ] Tested with production environment variables
- [ ] Removed all `console.log` with sensitive data
- [ ] Updated app version in `package.json` and `capacitor.config.json`

## APK Upload Checklist

Before uploading to Google Play:

- [ ] Signed with release keystore (not debug)
- [ ] Version code incremented
- [ ] Tested on physical devices (not just emulator)
- [ ] All permissions documented in store listing
- [ ] Privacy policy URL added to store listing
- [ ] Data collection disclosed in privacy policy
- [ ] Completed Google Play Data Safety form

## Security Incident Response

If API keys are compromised:

1. **Immediately revoke** the exposed key in respective console
2. **Generate new key** with proper restrictions
3. **Update `.env.local`** with new key
4. **Rebuild and redeploy** all applications
5. **Monitor usage** for unauthorized access
6. **Review logs** for potential abuse

## Contact

For security concerns or questions:
- Review this checklist before each build
- Update this document when security practices change
- Share with all team members

---

**Last Updated:** 2025-02-10
**Next Review:** Before each production build
