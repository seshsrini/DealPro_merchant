# ✅ Push Notifications Setup Checklist

## Current Status

### ✅ Already Completed

- [x] Removed React Native dependencies
- [x] Installed Capacitor Push Notifications plugin (`@capacitor/push-notifications@^6.0.5`)
- [x] Rewrote `services/fcmService.ts` for Capacitor
- [x] Build works: `npm run build` ✓
- [x] Android Gradle configured with Google Services plugin
- [x] AndroidManifest.xml updated with Firebase services
- [x] POST_NOTIFICATIONS permission added
- [x] Database table `fcm_tokens` exists in Supabase

### ⚠️ Pending (You Need to Do)

- [ ] **Download `google-services.json` from Firebase Console**
- [ ] **Place it in `android/app/` directory**
- [ ] **Integrate fcmService into login/logout flow**
- [ ] **Test on Android device**

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Download google-services.json

**Your Firebase Project:** `dealpro-eacaf`
**Your Android Package:** `com.dealpro.app`

1. Go to: https://console.firebase.google.com/project/dealpro-eacaf/settings/general
2. Scroll to "Your apps" section
3. Click on your Android app (package: `com.dealpro.app`)
4. Click "Download google-services.json"
5. Move it to: `C:\Srini\dealpro\dev\dealpro\android\app\google-services.json`

**PowerShell command to move file:**
```powershell
Move-Item "$env:USERPROFILE\Downloads\google-services.json" "C:\Srini\dealpro\dev\dealpro\android\app\google-services.json" -Force
```

### Step 2: Integrate into Login Flow

Find your login handler (likely in a file with "Auth" or "Login" in the name) and add:

```typescript
import { fcmService } from './services/fcmService';

// After successful login
const handleLogin = async (username: string, password: string) => {
  try {
    const { user, session } = await userService.loginUser(username, password);

    // Initialize push notifications
    await fcmService.initialize(user.id);

    // Your existing login code...
  } catch (error) {
    console.error('Login error:', error);
  }
};

// On logout
const handleLogout = async () => {
  await fcmService.unregisterToken();
  await fcmService.cleanup();
  // Your existing logout code...
};
```

### Step 3: Build and Test

```bash
# Build the web assets
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

**In Android Studio:**
1. Connect Android device or start emulator
2. Click the green "Run" button
3. Login to the app
4. Check Logcat for:
   ```
   [FCM] Initializing FCM for user: ...
   [FCM] Permission granted
   [FCM] Push registration success, token: abc123...
   [FCM] Token registered successfully: uuid-here
   ```

5. Check Supabase database:
   - Go to Table Editor → `fcm_tokens`
   - You should see a new row with your device token

---

## 🧪 Testing Push Notifications

### Method 1: Firebase Console (Easiest)

1. Go to Firebase Console → Cloud Messaging
2. Click "Send your first message"
3. Title: `Test Notification`
4. Body: `This is a test from Firebase`
5. Target: Select "FCM registration token"
6. Paste your token from Supabase `fcm_tokens` table
7. Click "Send message"
8. **You should receive the notification on your device!** 🎉

### Method 2: Supabase Edge Function

Create a test Edge Function to send bulk notifications:

```typescript
// supabase/functions/send-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  const { userId, title, body, data } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get user's tokens
  const { data: tokens } = await supabase
    .from('fcm_tokens')
    .select('device_token')
    .eq('user_id', userId)
    .eq('is_active', true);

  // Send via Firebase Admin SDK (you'll need to set this up)
  for (const token of tokens || []) {
    // Call Firebase Admin SDK or Cloud Messaging API
    console.log('Sending to token:', token.device_token);
  }

  return new Response(JSON.stringify({ success: true }));
});
```

---

## 📊 Expected Logs

### Browser/App Console (After Login)

```
[FCM] Initializing FCM for user: 550e8400-e29b-41d4-a716-446655440000
[FCM] Permission granted
[FCM] Push registration success, token: eR4T5Y6U7I8O9P0...
[FCM] Registering token for user: 550e8400-e29b-41d4-a716-446655440000
[FCM] Token registered successfully: 123e4567-e89b-12d3-a456-426614174000
[FCM] Initialization complete
```

### Android Studio Logcat

```
FirebaseMessaging: Token retrieved: eR4T5Y6U7I8O9P0...
Capacitor: [PushNotifications] Registration success
```

### When Notification Received

**Foreground (app open):**
```
[FCM] Push notification received: {title: "Test", body: "Hello", data: {...}}
```

**Background (app closed):**
- Notification appears in status bar
- Tap notification → App opens

**Notification Tapped:**
```
[FCM] Push notification action performed: {...}
[FCM] Notification tapped: {title: "Test", body: "Hello", data: {...}}
```

---

## 🐛 Troubleshooting

### "google-services.json not found"

**Error in build logs:**
```
google-services.json not found, google-services plugin not applied
```

**Solution:**
- Ensure file is at: `android/app/google-services.json` (NOT `android/google-services.json`)
- Verify with: `ls android/app | grep google`
- File should be named exactly `google-services.json`

### No token registered

**Check:**
1. Did you call `fcmService.initialize(user.id)` after login?
2. Did user grant notification permissions?
3. Are you testing on a real device (not web browser)?
4. Check console for errors

### Token registered but no notifications

**Check:**
1. Is Firebase Cloud Messaging enabled in Firebase Console?
2. Is `google-services.json` in the correct location?
3. Did you rebuild after adding `google-services.json`?
4. Is the token in Supabase marked as `is_active = true`?

### Permission denied

**On Android 13+:**
- App will request permission automatically via `fcmService.initialize()`
- User must tap "Allow" in the permission dialog
- If denied, you can prompt again or guide user to Settings

---

## 📁 File Locations Summary

| File | Location | Status |
|------|----------|--------|
| FCM Service | `services/fcmService.ts` | ✅ Ready |
| Package JSON | `package.json` | ✅ Push plugin installed |
| Android Manifest | `android/app/src/main/AndroidManifest.xml` | ✅ Firebase configured |
| App Build Gradle | `android/app/build.gradle` | ✅ Google Services plugin |
| Root Build Gradle | `android/build.gradle` | ✅ Classpath added |
| **google-services.json** | `android/app/google-services.json` | ❌ **YOU NEED TO ADD** |

---

## 🎯 Summary

**What works now:**
- ✅ Build completes without errors
- ✅ Capacitor sync successful
- ✅ Push notification infrastructure ready
- ✅ Android configuration complete

**What you need to do:**
1. Download `google-services.json` from Firebase
2. Place it in `android/app/` folder
3. Add `fcmService.initialize(user.id)` to login handler
4. Test on Android device

**Time to complete:** ~5 minutes
**Difficulty:** Easy - just download a file and add 1 line of code!

---

## 📞 Quick Links

- **Firebase Console:** https://console.firebase.google.com/project/dealpro-eacaf
- **Download Guide:** See `GET_GOOGLE_SERVICES.md`
- **Full Documentation:** See `PUSH_NOTIFICATIONS_CAPACITOR.md`

🚀 **You're almost there!**
