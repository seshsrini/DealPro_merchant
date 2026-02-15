# 🚀 FCM Quick Start for DealPro

Dependencies installed! ✅ Follow these steps to complete the FCM setup.

---

## ✅ What's Already Done

- ✅ Dependencies installed:
  - `@react-native-firebase/app`
  - `@react-native-firebase/messaging`
  - `react-native-device-info`
- ✅ `fcmService.ts` created and configured for bare React Native
- ✅ SQL migration file created (`create_fcm_tokens_table.sql`)
- ✅ Edge function created (`send-new-deal-notification`)

---

## 📋 Next Steps

### 1. Firebase Console Setup (10 minutes)

**Create Firebase Project:**
1. Go to https://console.firebase.google.com
2. Click "Add Project" → Name it "DealPro"
3. Follow the wizard

**Add Android App:**
1. Click "Add app" → Select Android
2. Package name: Check your `android/app/build.gradle` for `applicationId`
3. Download `google-services.json`
4. Place it in: `C:\Srini\dealpro\dev\dealpro\android\app\google-services.json`

**Add iOS App:**
1. Click "Add app" → Select iOS
2. Bundle ID: Check your Xcode project settings
3. Download `GoogleService-Info.plist`
4. Add to Xcode project

**Generate Service Account Key:**
1. Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file securely (DON'T commit to Git!)

---

### 2. Configure Android (5 minutes)

**File: `android/build.gradle`**

Add this to the `dependencies` section inside `buildscript`:

```gradle
buildscript {
  dependencies {
    classpath("com.android.tools.build:gradle")
    classpath("com.facebook.react:react-native-gradle-plugin")

    // ADD THIS LINE:
    classpath 'com.google.gms:google-services:4.4.0'
  }
}
```

**File: `android/app/build.gradle`**

Add this at the BOTTOM of the file:

```gradle
apply plugin: 'com.google.gms.google-services'
```

**File: `android/app/src/main/AndroidManifest.xml`**

Add inside `<application>`:

```xml
<meta-data
  android:name="com.google.firebase.messaging.default_notification_icon"
  android:resource="@drawable/ic_notification" />

<meta-data
  android:name="com.google.firebase.messaging.default_notification_color"
  android:resource="@color/notification_color" />
```

**Create notification icon:**

File: `android/app/src/main/res/drawable/ic_notification.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2z"/>
</vector>
```

**Create colors file:**

File: `android/app/src/main/res/values/colors.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="notification_color">#FFA500</color>
</resources>
```

---

### 3. Configure iOS (5 minutes)

**Run pod install:**

```bash
cd ios
pod install
cd ..
```

**Open Xcode:**

```bash
open ios/YourApp.xcworkspace
```

**Add GoogleService-Info.plist:**
- Drag the downloaded file into your project
- Ensure "Copy items if needed" is checked

**Enable capabilities:**
1. Select your app target
2. Go to **Signing & Capabilities**
3. Click **+ Capability**
4. Add **Push Notifications**
5. Add **Background Modes** → Check "Remote notifications"

**Update AppDelegate:**

File: `ios/YourApp/AppDelegate.mm`

Add at the top:
```objc
#import <Firebase.h>
```

Add inside `didFinishLaunchingWithOptions`:
```objc
if ([FIRApp defaultApp] == nil) {
  [FIRApp configure];
}
```

---

### 4. Database Setup (2 minutes)

**Run the SQL migration:**

```bash
# Option 1: Via Supabase Dashboard
# Copy contents of supabase/migrations/create_fcm_tokens_table.sql
# Paste into SQL Editor and run

# Option 2: Via Supabase CLI
supabase db push
```

**Verify:**

```sql
SELECT * FROM fcm_tokens;
```

---

### 5. Integrate into Your App (5 minutes)

**Find your login success handler** (probably in `userService.ts` or `AuthStack.tsx`):

**Add this import at the top:**
```typescript
import { fcmService } from './services/fcmService';
```

**After successful login, add:**
```typescript
const handleLogin = async () => {
  try {
    const { user, session } = await userService.loginUser(username, password);

    // 🔔 Initialize FCM
    await fcmService.initialize(user.id);

    // Continue with your normal flow
    setUser(user);
    setView('consumer_dashboard');
  } catch (error) {
    console.error('Login error:', error);
  }
};
```

**On logout, add:**
```typescript
const handleLogout = async () => {
  try {
    // 🔔 Unregister FCM token
    await fcmService.unregisterToken();

    await userService.logoutUser();
    setUser(null);
    setView('login');
  } catch (error) {
    console.error('Logout error:', error);
  }
};
```

---

### 6. Deploy Edge Function (5 minutes)

**Set environment variables in Supabase Dashboard:**

Go to: Project Settings → Edge Functions → Add secrets:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour\nKey\nHere\n-----END PRIVATE KEY-----
```

**Deploy the function:**

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy send-new-deal-notification
```

---

### 7. Create Database Webhook (2 minutes)

**In Supabase Dashboard:**

1. Go to: Database → Webhooks
2. Click "Create a new hook"
3. Configure:
   - Name: `new-deal-notification`
   - Table: `campaigns`
   - Events: `INSERT`
   - Type: `supabase_function`
   - Function: `send-new-deal-notification`
4. Click "Confirm"

---

### 8. Test It! (5 minutes)

**Run the app:**

```bash
npm run android
# or
npm run ios
```

**Check logs for:**
```
[FCM] Permission granted
[FCM] Token retrieved: ...
[FCM] Token registered successfully
```

**Test notification by inserting a deal:**

```sql
INSERT INTO campaigns (
  campaign_id, shop_name, deal_heading, offer_value,
  city, category, status, start_date, end_date
) VALUES (
  gen_random_uuid(), 'Test Store', 'Test Deal',
  '50% Off', 'Bangalore', 'Food & Dining',
  'active', NOW(), NOW() + INTERVAL '7 days'
);
```

**You should receive a notification:** "🎉 New Deal Live!"

---

## 🎯 Quick Checklist

Copy this and check off as you go:

```
[ ] Firebase project created
[ ] Android app added to Firebase
[ ] iOS app added to Firebase
[ ] google-services.json downloaded and placed
[ ] GoogleService-Info.plist downloaded and added
[ ] Service account key generated
[ ] android/build.gradle updated
[ ] android/app/build.gradle updated
[ ] AndroidManifest.xml updated
[ ] Notification icon created
[ ] colors.xml created
[ ] pod install run
[ ] GoogleService-Info.plist added to Xcode
[ ] Push Notifications capability enabled
[ ] Background Modes enabled
[ ] AppDelegate.mm updated
[ ] SQL migration run
[ ] fcm_tokens table created
[ ] fcmService.initialize() added to login
[ ] fcmService.unregisterToken() added to logout
[ ] Supabase environment variables set
[ ] Edge function deployed
[ ] Database webhook created
[ ] App tested - notification received ✅
```

---

## 🆘 Troubleshooting

**"No token available"**
- Check Firebase config files are in place
- Check permissions: `fcmService.hasPermission()`

**"Build failed"**
- Clean build: `cd android && ./gradlew clean`
- Rebuild: `npm run android`
- For iOS: Clean build folder in Xcode

**"Notification not received"**
- Check Supabase function logs: `supabase functions logs send-new-deal-notification`
- Verify webhook is active in Supabase Dashboard
- Check FCM token in database: `SELECT * FROM fcm_tokens WHERE user_id = 'YOUR_ID'`

---

## 📚 Full Documentation

For detailed information, see:
- [FCM_INSTALLATION_BARE_RN.md](./FCM_INSTALLATION_BARE_RN.md) - Detailed setup
- [FCM_SETUP_GUIDE.md](./FCM_SETUP_GUIDE.md) - Complete guide with troubleshooting

---

**Total setup time: ~40 minutes**

Good luck! 🚀
