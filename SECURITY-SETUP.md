# Security Setup Guide

This guide walks you through securing your DealPro application before building the APK.

## Quick Start

1. **Copy environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your API keys in `.env.local`:**
   ```bash
   VITE_GOOGLE_MAPS_API_KEY=your_actual_google_maps_key
   VITE_SUPABASE_URL=your_actual_supabase_url
   VITE_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
   ```

3. **Never commit `.env.local` to git!** (Already in .gitignore)

## Detailed Setup

### 1. Secure Your Google Maps API Key

#### Get Your Current Key
Your current Google Maps API key is in your `.env.local` file.

#### Restrict It in Google Cloud Console

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)

2. Find your API key and click **Edit**

3. Under **Application restrictions**, select **Android apps**

4. Click **Add an item** and enter:
   - **Package name:** `com.dealpro.app` (or your actual package from `capacitor.config.json`)
   - **SHA-1 certificate fingerprint:** (see below how to get it)

5. Under **API restrictions**, select **Restrict key**

6. Select only the APIs you need:
   - ✅ Maps JavaScript API
   - ✅ Places API
   - ✅ Geocoding API

7. Click **Save**

#### Get Your SHA-1 Fingerprint

**For Debug Builds:**
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**For Release Builds:**
```bash
keytool -list -v -keystore /path/to/your/release.keystore -alias your-key-alias
```

Look for a line like:
```
SHA1: A1:B2:C3:D4:E5:F6:...
```

Copy this fingerprint and add it to your API key restrictions.

### 2. Secure Your Supabase Connection

#### Enable Row Level Security (RLS)

**CRITICAL:** Without RLS, anyone with your anon key can access all data!

1. Go to [Supabase Dashboard](https://app.supabase.com/)

2. Select your project

3. Go to **Database** → **Tables**

4. For **EACH TABLE**, click the three dots menu → **Edit**

5. Enable **Row Level Security (RLS)**

6. Create policies for each table. Example for `users` table:

   ```sql
   -- Users can only read their own data
   CREATE POLICY "Users can view own profile"
   ON users
   FOR SELECT
   USING (auth.uid() = id);

   -- Users can only update their own data
   CREATE POLICY "Users can update own profile"
   ON users
   FOR UPDATE
   USING (auth.uid() = id);
   ```

7. Repeat for all tables: `merchants`, `campaigns`, `redemptions`, etc.

#### Verify Your Keys

In `.env.local`, ensure you're using the **anon** key, not the **service_role** key:

```bash
# ✅ CORRECT - Use anon key (starts with eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9)
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ WRONG - Never use service_role key in client app!
# Service role key bypasses RLS - only use on server!
```

### 3. Test Your Security Setup

#### Test Google Maps Restrictions

1. Build your app: `npm run build`
2. Install on a real device
3. Try to use the map - it should work
4. Try using the same API key from a different app - it should fail

#### Test Supabase RLS

1. Try to query data from Supabase console
2. Without authentication, queries should return no data
3. With proper user authentication, queries should work

### 4. Common Issues

#### "Google Maps failed to load"

**Cause:** API key restrictions are too strict or SHA-1 doesn't match

**Solution:**
1. Double-check your package name matches exactly
2. Verify SHA-1 fingerprint is correct
3. For debug builds, use debug keystore SHA-1
4. For release builds, use release keystore SHA-1
5. Wait 5 minutes after changing restrictions for them to propagate

#### "Failed to fetch from Supabase"

**Cause:** RLS is blocking your queries

**Solution:**
1. Check if you're logged in (session exists)
2. Verify RLS policies allow the operation
3. Check Supabase logs for RLS denials
4. Test with RLS temporarily disabled to confirm it's the issue

#### "Environment variable undefined"

**Cause:** `.env.local` not loaded or variable name wrong

**Solution:**
1. Ensure file is named exactly `.env.local`
2. Restart dev server after changing `.env.local`
3. Variable names must start with `VITE_`
4. Check `vite-env.d.ts` includes the variable

## Build Process

### Development Build

```bash
npm run dev
```

Uses `.env.local` automatically.

### Production Build

```bash
npm run build
ionic cap sync
ionic cap build android
```

Still uses `.env.local` - variables are embedded at build time.

### Release Build

1. Generate release keystore (first time only):
   ```bash
   keytool -genkey -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Configure in `android/app/build.gradle`:
   ```gradle
   signingConfigs {
       release {
           storeFile file('../../release.keystore')
           storePassword 'your_store_password'
           keyAlias 'release'
           keyPassword 'your_key_password'
       }
   }
   ```

3. Build:
   ```bash
   npm run build
   cd android
   ./gradlew assembleRelease
   ```

4. APK will be in: `android/app/build/outputs/apk/release/app-release.apk`

## Security Monitoring

### Check for Exposed Secrets

Before each commit:
```bash
# Search for potential exposed secrets
grep -r "AIza" . --exclude-dir=node_modules
grep -r "eyJhbGci" . --exclude-dir=node_modules
```

If any matches found outside `.env.local`, those are exposed!

### Audit Dependencies

Before each build:
```bash
npm audit
npm audit fix
```

### Monitor API Usage

1. **Google Maps:** Check [Google Cloud Console - APIs & Services](https://console.cloud.google.com/apis/dashboard)
2. **Supabase:** Check [Supabase Dashboard - Settings - API](https://app.supabase.com/project/_/settings/api)

Unexpected high usage may indicate:
- API key leaked
- Unauthorized access
- Inefficient code making too many requests

## Emergency Response

### If Google Maps API Key Is Exposed

1. **Immediately** go to Google Cloud Console
2. **Delete** the exposed key
3. **Create** a new key with restrictions
4. **Update** `.env.local` with new key
5. **Rebuild** all applications
6. **Monitor** billing for unusual charges

### If Supabase Credentials Are Exposed

1. **Don't panic** - anon key is meant to be public IF RLS is enabled
2. **Verify** RLS is enabled on all tables
3. **Check** Supabase logs for suspicious activity
4. **Review** RLS policies are correct
5. If needed, **rotate** credentials from Supabase Dashboard

## Best Practices

✅ **DO:**
- Use environment variables for all secrets
- Enable RLS on all Supabase tables
- Restrict API keys in cloud consoles
- Test on real devices before release
- Keep dependencies updated
- Review this guide before each build

❌ **DON'T:**
- Commit `.env.local` to git
- Use service_role key in client app
- Hardcode API keys in source files
- Skip RLS for "temporary" tables
- Ignore security warnings
- Share keystores or passwords

## Help

If you're stuck:
1. Check `SECURITY-CHECKLIST.md` for detailed checklist
2. Review console errors for specific issues
3. Check Supabase/Google Cloud logs
4. Verify all environment variables are set
5. Try with a fresh `.env.local` from `.env.example`

---

**Remember:** Security is not optional. Follow this guide for every build!
