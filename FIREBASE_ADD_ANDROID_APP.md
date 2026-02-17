# 📱 Add Android App to Firebase & Download google-services.json

## Current Situation

You're looking at the **web app configuration** in Firebase Console. That's for web browsers (JavaScript SDK).

For Android push notifications, you need to:
1. ✅ Add an **Android app** to your Firebase project
2. ✅ Download `google-services.json` specifically for Android
3. ✅ Place it in your Android app directory

---

## 🚀 Step-by-Step Instructions

### Step 1: Open Firebase Console

Go to: **https://console.firebase.google.com/project/dealpro-eacaf/settings/general**

You should see:
- Project name: **dealpro-eacaf**
- A "Your apps" section

### Step 2: Check for Android App

In the "Your apps" section, look for:
- 🌐 Web app icon (globe) - You have this
- 🤖 Android icon (robot) - **You need to add this**
- 🍎 iOS icon (apple) - Not needed yet

**If you see an Android app (🤖):**
- Click on it
- Scroll down to find "google-services.json"
- Click "Download google-services.json"
- Skip to Step 4

**If you DON'T see an Android app:**
- Continue to Step 3

### Step 3: Add Android App to Firebase

1. Click the **"Add app"** button (or the **"+"** icon)
2. Select the **Android icon** 🤖
3. You'll see a form with:

#### A. Android package name (REQUIRED)
```
com.dealpro.app
```
**IMPORTANT:** This MUST match exactly. It's your app's unique identifier.

#### B. App nickname (OPTIONAL)
```
DealPro Android
```
You can use any friendly name here.

#### C. Debug signing certificate SHA-1 (OPTIONAL)
Leave this blank for now. You can add it later if needed for Google Sign-In or other features.

4. Click **"Register app"**

### Step 4: Download google-services.json

After registering (or if you already had an Android app):

1. Firebase will show: **"Download google-services.json"**
2. Click the **Download** button
3. File will be saved to your Downloads folder
4. **Keep the file as-is** (do not rename it)

### Step 5: Move File to Android App Directory

#### Option A: Use the PowerShell Script (Easiest)

```powershell
cd C:\Srini\dealpro\dev\dealpro
.\move-google-services.ps1
```

The script will:
- Find google-services.json in your Downloads
- Move it to android/app/
- Verify it's in the correct location

#### Option B: Manual Move

1. Open File Explorer
2. Go to: `C:\Users\[YourName]\Downloads\google-services.json`
3. Cut the file (Ctrl+X)
4. Navigate to: `C:\Srini\dealpro\dev\dealpro\android\app\`
5. Paste it (Ctrl+V)

#### Option C: PowerShell Command

```powershell
Move-Item "$env:USERPROFILE\Downloads\google-services.json" "C:\Srini\dealpro\dev\dealpro\android\app\google-services.json" -Force
```

### Step 6: Verify File Location

```bash
ls android/app | grep google
```

You should see:
```
google-services.json
```

---

## ✅ What the File Should Look Like

The `google-services.json` file should have this structure:

```json
{
  "project_info": {
    "project_number": "330504481876",
    "project_id": "dealpro-eacaf",
    "storage_bucket": "dealpro-eacaf.firebasestorage.app"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:330504481876:android:...",
        "android_client_info": {
          "package_name": "com.dealpro.app"
        }
      },
      "oauth_client": [...],
      "api_key": [
        {
          "current_key": "AIzaSy..."
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": []
        }
      }
    }
  ],
  "configuration_version": "1"
}
```

**Key things to check:**
- ✅ `project_id`: Should be `dealpro-eacaf`
- ✅ `package_name`: Should be `com.dealpro.app`
- ✅ `project_number`: Should be `330504481876` (your Firebase project number)

---

## 🧪 After Adding the File

Once google-services.json is in place:

### 1. Rebuild the app
```bash
npm run build
```

### 2. Sync to Android
```bash
npx cap sync android
```

You should see in the output:
```
✓ Copying web assets from dist to android\app\src\main\assets\public
✓ Creating capacitor.config.json in android\app\src\main\assets
✓ copy android
✓ Updating Android plugins
   Found 3 Capacitor plugins for android:
   @capacitor/push-notifications@6.0.5  ← This is important!
✓ update android
```

### 3. Open in Android Studio
```bash
npx cap open android
```

### 4. Check Build Logs

In Android Studio, look at the Build output. You should see:
```
Parsing json file: google-services.json
```

If you see this, the file is correctly integrated! ✅

---

## 🚨 Common Issues

### Issue 1: "google-services.json not found"

**Error in build logs:**
```
google-services.json not found, google-services plugin not applied
```

**Solution:**
- File must be at: `android/app/google-services.json`
- NOT at: `android/google-services.json` ❌
- NOT at: `google-services.json` ❌
- Verify with: `ls android/app | grep google`

### Issue 2: Package name mismatch

**Error in build:**
```
Error: Package name 'com.different.app' does not match expected package name 'com.dealpro.app'
```

**Solution:**
- Download a new google-services.json with package name: `com.dealpro.app`
- Or update your app's package name in `android/app/build.gradle`

### Issue 3: Multiple google-services.json files

**Error:**
```
Multiple google-services.json files found
```

**Solution:**
- Keep only ONE file in `android/app/`
- Delete any extras in `android/` or root directory

---

## 🎯 Quick Checklist

After downloading and moving google-services.json:

- [ ] File is at: `android/app/google-services.json`
- [ ] Package name in file is: `com.dealpro.app`
- [ ] Project ID in file is: `dealpro-eacaf`
- [ ] File is valid JSON (no corruption)
- [ ] `npm run build` completes successfully
- [ ] `npx cap sync android` shows push-notifications plugin
- [ ] Android Studio build doesn't show google-services errors

---

## 📞 Firebase Console Quick Links

| Link | Purpose |
|------|---------|
| [Project Settings](https://console.firebase.google.com/project/dealpro-eacaf/settings/general) | Add Android app, download google-services.json |
| [Cloud Messaging](https://console.firebase.google.com/project/dealpro-eacaf/messaging) | Send test notifications |
| [Analytics](https://console.firebase.google.com/project/dealpro-eacaf/analytics) | View app analytics |

---

## 🎉 Success Criteria

You'll know it worked when:

1. **File exists:**
   ```bash
   ls android/app/google-services.json
   # Should show: google-services.json
   ```

2. **Build succeeds:**
   ```bash
   npm run build
   # Should complete without errors
   ```

3. **Android Studio loads without errors:**
   ```bash
   npx cap open android
   # Should open Android Studio with no google-services errors
   ```

4. **Push notifications work:**
   - Login to app on Android device
   - Check console logs for: `[FCM] Push registration success, token: ...`
   - Check Supabase `fcm_tokens` table for new token entry

---

## 📝 Summary

**Web Config (what you saw):**
- JavaScript SDK configuration
- For web browsers
- Shown in Firebase Console → General tab
- Used with `initializeApp(firebaseConfig)`

**Android Config (what you need):**
- google-services.json file
- For Android apps only
- Download from Firebase Console → Android app
- Place in `android/app/` directory

**They are different files for different platforms!**

---

## ✨ Next Step

👉 **Go to Firebase Console and add the Android app now:**
https://console.firebase.google.com/project/dealpro-eacaf/settings/general

Then run: `.\move-google-services.ps1` to move the downloaded file!
