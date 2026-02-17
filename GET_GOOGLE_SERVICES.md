# 📱 How to Download google-services.json for Android Push Notifications

## What's the Difference?

You currently have:
- ✅ `dealpro-eacaf-firebase-adminsdk-fbsvc-8c29c46deb.json` - **Admin SDK** (for server/backend)

You need:
- ❌ `google-services.json` - **Android App Configuration** (for push notifications)

These are **two different files** for different purposes!

---

## 🔽 Step-by-Step Download Instructions

### 1. Go to Firebase Console

Visit: https://console.firebase.google.com/project/dealpro-eacaf/settings/general

### 2. Find Your Android App

- Scroll down to "Your apps" section
- Look for your Android app (package name likely: `com.dealpro.app` or similar)
- If you don't see an Android app, click "Add app" → Android icon

### 3. Download google-services.json

- Click on your Android app
- Look for the "google-services.json" download button
- Click **"Download google-services.json"**
- Save it to your Downloads folder

### 4. Move File to Correct Location

After downloading, move it to:
```
C:\Srini\dealpro\dev\dealpro\android\app\google-services.json
```

**PowerShell command:**
```powershell
Move-Item "$env:USERPROFILE\Downloads\google-services.json" "C:\Srini\dealpro\dev\dealpro\android\app\google-services.json" -Force
```

### 5. Verify File Placement

Check that the file exists:
```bash
ls C:\Srini\dealpro\dev\dealpro\android\app | grep google
```

You should see: `google-services.json`

---

## ✅ What the File Contains

The `google-services.json` file contains:
- Your Firebase project ID
- Your Android app's package name
- API keys for Firebase services
- Configuration for Cloud Messaging (FCM)

**Example structure:**
```json
{
  "project_info": {
    "project_number": "123456789",
    "project_id": "dealpro-eacaf",
    "storage_bucket": "..."
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "...",
        "android_client_info": {
          "package_name": "com.dealpro.app"
        }
      },
      "oauth_client": [...],
      "api_key": [...],
      "services": {
        "appinvite_service": {...}
      }
    }
  ],
  "configuration_version": "1"
}
```

---

## 🚨 Important Notes

1. **Never commit to Git**: Add to `.gitignore`:
   ```
   android/app/google-services.json
   ```

2. **Package Name Must Match**: The package name in `google-services.json` must match your Android app's package name in `android/app/build.gradle`

3. **Different from Admin SDK**: The admin SDK key is for backend operations (sending notifications from server), while `google-services.json` is for the Android app to receive notifications

---

## 🔍 If You Don't Have an Android App in Firebase

If you don't see an Android app in Firebase Console, create one:

1. Click "Add app" → Select Android icon
2. **Android package name**: Check your `android/app/build.gradle` file for `applicationId`
   - Common format: `com.yourcompany.dealpro`
3. **App nickname** (optional): DealPro Android
4. **Debug signing certificate** (optional): Skip for now
5. Click "Register app"
6. Download the `google-services.json` file
7. Follow Firebase setup steps (we've already done this!)

---

## ✨ After Adding the File

Once you have `google-services.json` in place:

1. **Sync Android project:**
   ```bash
   npx cap sync android
   ```

2. **Open in Android Studio:**
   ```bash
   npx cap open android
   ```

3. **Run the app** and check console logs:
   ```
   [FCM] Initializing FCM for user: ...
   [FCM] Permission granted
   [FCM] Push registration success, token: ...
   ```

4. **Verify in database**: Check Supabase `fcm_tokens` table for the new token entry

---

## 📞 Quick Link

Direct link to your Firebase project settings:
**https://console.firebase.google.com/project/dealpro-eacaf/settings/general**

Look for "Your apps" section → Android app → Download google-services.json
