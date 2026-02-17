# 🔔 Push Notifications with Capacitor

This guide explains the new push notification setup using **Capacitor's native plugins** (not React Native).

---

## ✅ What Was Done

### 1. Removed React Native Dependencies
- ❌ Removed `@react-native-firebase/app`
- ❌ Removed `@react-native-firebase/messaging`
- ❌ Removed `react-native-device-info`

### 2. Added Capacitor Push Notifications
- ✅ Installed `@capacitor/push-notifications@^6.0.5`
- ✅ Rewrote `services/fcmService.ts` to use Capacitor APIs
- ✅ Build now works: `npm run build` ✓
- ✅ Android sync successful: `npx cap sync android` ✓

---

## 📱 How It Works

### Capacitor Push Notifications Architecture

```
User Login
    ↓
fcmService.initialize(userId)
    ↓
Request Permissions (iOS/Android only, skipped on web)
    ↓
Register with APNS/FCM
    ↓
Receive Token → Save to Supabase database
    ↓
Listen for notifications
```

### Key Features

- **Permission Management**: Request and check notification permissions
- **Token Registration**: Automatically saves FCM tokens to Supabase
- **Foreground Notifications**: Handles notifications when app is open
- **Background Notifications**: Handles notifications when app is closed
- **Notification Tap**: Detects when user taps a notification
- **Platform Detection**: Only runs on native platforms (iOS/Android), skips web

---

## 🔧 Integration Steps

### Step 1: Initialize on Login

Update your login handler (likely in `AuthStack.tsx` or similar):

```typescript
import { fcmService } from './services/fcmService';

// After successful login
const handleLogin = async (username: string, password: string) => {
  try {
    const { user, session } = await userService.loginUser(username, password);

    // Initialize push notifications
    await fcmService.initialize(user.id);

    // Rest of your login logic...
  } catch (error) {
    console.error('Login error:', error);
  }
};
```

### Step 2: Cleanup on Logout

Update your logout handler:

```typescript
const handleLogout = async () => {
  try {
    // Unregister push token
    await fcmService.unregisterToken();
    await fcmService.cleanup();

    // Rest of your logout logic...
  } catch (error) {
    console.error('Logout error:', error);
  }
};
```

### Step 3: Configure Android

#### A. Update `android/app/src/main/AndroidManifest.xml`

Add inside `<application>` tag:

```xml
<!-- Firebase Cloud Messaging -->
<service
    android:name="com.google.firebase.messaging.FirebaseMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>

<!-- Default notification channel (required for Android 8.0+) -->
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="default_channel" />
```

#### B. Add Firebase Config

Place your `google-services.json` file in:
```
android/app/google-services.json
```

#### C. Update `android/build.gradle`

Add the Google Services plugin:

```gradle
buildscript {
    dependencies {
        // Add this line
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

#### D. Update `android/app/build.gradle`

At the bottom of the file, add:

```gradle
apply plugin: 'com.google.gms.google-services'
```

---

## 🎯 Usage Examples

### Check Permission Status

```typescript
const hasPermission = await fcmService.hasPermission();
if (!hasPermission) {
  const granted = await fcmService.requestPermissions();
  if (granted) {
    console.log('Notifications enabled!');
  }
}
```

### Get Permission Status String

```typescript
const status = await fcmService.getPermissionStatus();
console.log('Permission status:', status); // 'granted', 'denied', 'prompt'
```

### Clear All Notifications

```typescript
await fcmService.removeAllDeliveredNotifications();
```

### Get Delivered Notifications (iOS only)

```typescript
const notifications = await fcmService.getDeliveredNotifications();
console.log('Pending notifications:', notifications);
```

---

## 📊 Database Table

The fcmService saves tokens to the `fcm_tokens` table:

```sql
CREATE TABLE fcm_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT UNIQUE NOT NULL,
  device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')),
  device_name TEXT,
  app_version TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🧪 Testing Push Notifications

### 1. Test on Android Device/Emulator

```bash
npm run build
npx cap sync android
npx cap open android
```

Then in Android Studio:
1. Run the app on a device/emulator
2. Login as a user
3. Check logs for: `[FCM] Push registration success, token: ...`
4. Check Supabase database for the token in `fcm_tokens` table

### 2. Send Test Notification via Firebase Console

1. Go to Firebase Console → Cloud Messaging
2. Click "Send your first message"
3. Enter notification title and body
4. Under "Target", select "FCM registration token"
5. Paste the token from your database
6. Send notification
7. You should receive it on your device!

### 3. Send Test Notification via Supabase Edge Function

Create a test Edge Function to send notifications:

```typescript
import { createClient } from '@supabase/supabase-js';

const sendPushNotification = async (userId: string, title: string, body: string) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get user's FCM tokens
  const { data: tokens } = await supabase
    .from('fcm_tokens')
    .select('device_token')
    .eq('user_id', userId)
    .eq('is_active', true);

  // Send notification to each token via Firebase Admin SDK
  for (const token of tokens) {
    await admin.messaging().send({
      token: token.device_token,
      notification: { title, body },
      data: { dealId: '123', type: 'new_deal' }
    });
  }
};
```

---

## 🐛 Troubleshooting

### Build fails with "Cannot find module '@capacitor/push-notifications'"

```bash
npm install @capacitor/push-notifications@^6.0.5
npm run build
```

### Token not registered in database

Check browser/device console for:
- `[FCM] Initializing FCM for user: ...`
- `[FCM] Permission granted`
- `[FCM] Push registration success, token: ...`
- `[FCM] Token registered successfully: ...`

### Notifications not received

1. **Check Firebase Console**: Ensure Firebase Cloud Messaging is enabled
2. **Check google-services.json**: Must be in `android/app/` directory
3. **Check AndroidManifest.xml**: Ensure Firebase services are declared
4. **Check permissions**: User must grant notification permissions
5. **Check token**: Verify token exists in database with `is_active = true`

### iOS: Permission denied

iOS requires notification permissions to be requested. The fcmService handles this automatically, but you can also prompt earlier:

```typescript
const granted = await fcmService.requestPermissions();
```

---

## 🚀 Next Steps

1. ✅ **Build the app**: `npm run build` (already working)
2. ✅ **Sync to Android**: `npx cap sync android` (already done)
3. ⚠️ **Integrate into login flow**: Add `fcmService.initialize(user.id)` after login
4. ⚠️ **Configure Firebase**: Add `google-services.json` to Android project
5. ⚠️ **Test on device**: Run in Android Studio and verify token registration

---

## 📝 Key Differences from React Native

| Feature | React Native Firebase | Capacitor Push Notifications |
|---------|----------------------|------------------------------|
| Package | `@react-native-firebase/messaging` | `@capacitor/push-notifications` |
| Platform | React Native only | Web, iOS, Android |
| Import | `import messaging from '@react-native-firebase/messaging'` | `import { PushNotifications } from '@capacitor/push-notifications'` |
| Permission | `messaging().requestPermission()` | `PushNotifications.requestPermissions()` |
| Get Token | `messaging().getToken()` | Received via `'registration'` listener |
| Foreground | `messaging().onMessage()` | `PushNotifications.addListener('pushNotificationReceived')` |
| Background | `messaging().setBackgroundMessageHandler()` | Automatic (system handles it) |
| Build | Requires React Native | Works with Vite/Capacitor |

---

## ✨ Summary

- ✅ **No more React Native**: Pure Capacitor/Vite app
- ✅ **Build works**: `npm run build` completes successfully
- ✅ **Push notifications ready**: Just needs Firebase configuration
- ✅ **Database integration**: Tokens auto-save to Supabase
- ✅ **Same API**: fcmService API remains the same for your app code

**You're all set!** Just integrate the service into your login/logout flow and configure Firebase for Android. 🎉
