# Firebase Cloud Messaging (FCM) Setup Guide for DealPro

Complete guide to implement push notifications in your DealPro app using Firebase Cloud Messaging and Supabase.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Firebase Setup](#firebase-setup)
3. [Database Setup](#database-setup)
4. [React Native Setup](#react-native-setup)
5. [Supabase Edge Function Setup](#supabase-edge-function-setup)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

Before starting, ensure you have:

- ✅ A Firebase project (create one at [console.firebase.google.com](https://console.firebase.google.com))
- ✅ Supabase project with database access
- ✅ React Native development environment
- ✅ Supabase CLI installed (`npm install -g supabase`)

---

## 2. Firebase Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add Project"
3. Enter project name: `dealpro` (or your preferred name)
4. Follow the wizard to create the project

### Step 2: Add Apps to Firebase Project

**For Android:**
1. Click "Add app" → Select Android
2. Enter package name (e.g., `com.dealpro.app`)
3. Download `google-services.json`
4. Place it in `android/app/` directory

**For iOS:**
1. Click "Add app" → Select iOS
2. Enter bundle ID (e.g., `com.dealpro.app`)
3. Download `GoogleService-Info.plist`
4. Add it to your Xcode project

### Step 3: Enable Cloud Messaging

1. In Firebase Console, go to **Project Settings** → **Cloud Messaging**
2. Note your **Server Key** (legacy) - you'll need this later
3. Enable Cloud Messaging API (v1) in Google Cloud Console

### Step 4: Generate Service Account Key

1. Go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Download the JSON file - it contains:
   - `project_id`
   - `client_email`
   - `private_key`
4. **KEEP THIS FILE SECURE** - never commit to Git!

---

## 3. Database Setup

### Step 1: Create FCM Tokens Table

Run the SQL migration in Supabase SQL Editor:

```bash
# Navigate to your project
cd C:\Srini\dealpro\dev\dealpro

# Run the migration
supabase db push
```

Or manually execute:
```sql
-- Copy contents from:
-- supabase/migrations/create_fcm_tokens_table.sql
```

### Step 2: Verify Table Creation

```sql
-- Check if table exists
SELECT * FROM public.fcm_tokens;

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'fcm_tokens';
```

---

## 4. React Native Setup

### Step 1: Install Dependencies

```bash
# Install Firebase dependencies
npm install @react-native-firebase/app @react-native-firebase/messaging

# Install Expo dependencies (if using Expo)
npx expo install expo-device expo-constants

# For bare React Native:
npm install react-native-device-info
```

### Step 2: Configure Android

**android/build.gradle:**
```gradle
buildscript {
  dependencies {
    // Add this line
    classpath 'com.google.gms:google-services:4.3.15'
  }
}
```

**android/app/build.gradle:**
```gradle
// At the bottom of the file
apply plugin: 'com.google.gms.google-services'
```

**android/app/src/main/AndroidManifest.xml:**
```xml
<manifest>
  <application>
    <!-- Add these inside <application> -->
    <meta-data
      android:name="com.google.firebase.messaging.default_notification_icon"
      android:resource="@drawable/ic_notification" />

    <meta-data
      android:name="com.google.firebase.messaging.default_notification_color"
      android:resource="@color/notification_color" />
  </application>
</manifest>
```

### Step 3: Configure iOS

1. Open `ios/{ProjectName}.xcworkspace` in Xcode
2. Add `GoogleService-Info.plist` to your project
3. Enable Push Notifications capability:
   - Select your app target
   - Go to **Signing & Capabilities**
   - Click **+ Capability**
   - Add **Push Notifications**
   - Add **Background Modes** → Check "Remote notifications"

**ios/Podfile:**
```ruby
# Add this at the top
use_frameworks! :linkage => :static

target 'YourApp' do
  # Add Firebase pods
  pod 'Firebase/Messaging'
end
```

Run:
```bash
cd ios
pod install
cd ..
```

### Step 4: Initialize FCM in Your App

**In your login success handler (userService.ts or AuthStack.tsx):**

```typescript
import { fcmService } from './services/fcmService';

// After successful login
const handleLogin = async () => {
  try {
    const { user, session } = await userService.loginUser(username, password);

    // Initialize FCM for this user
    await fcmService.initialize(user.id);

    // Continue with your normal login flow
    setUser(user);
    setView('consumer_dashboard');
  } catch (error) {
    console.error('Login error:', error);
  }
};
```

**On logout:**

```typescript
const handleLogout = async () => {
  try {
    // Unregister FCM token
    await fcmService.unregisterToken();

    // Continue with normal logout
    await userService.logoutUser();
    setUser(null);
    setView('login');
  } catch (error) {
    console.error('Logout error:', error);
  }
};
```

---

## 5. Supabase Edge Function Setup

### Step 1: Set Environment Variables

In Supabase Dashboard:

1. Go to **Project Settings** → **Edge Functions**
2. Add these secrets:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----
```

**Get these values from the service account JSON you downloaded earlier.**

### Step 2: Deploy the Edge Function

```bash
# Navigate to your project
cd C:\Srini\dealpro\dev\dealpro

# Login to Supabase CLI
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy send-new-deal-notification
```

### Step 3: Create Database Webhook (Trigger)

**Option A: Via Supabase Dashboard**

1. Go to **Database** → **Webhooks**
2. Click **Create a new hook**
3. Configure:
   - **Name:** `new-deal-notification`
   - **Table:** `campaigns` (or your deals table)
   - **Events:** `INSERT`
   - **Type:** `supabase_function`
   - **Function:** `send-new-deal-notification`
4. Click **Confirm**

**Option B: Via SQL**

```sql
-- Create a trigger that calls the edge function
CREATE OR REPLACE FUNCTION public.notify_new_deal()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-new-deal-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object('record', NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_deal
AFTER INSERT ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_deal();
```

---

## 6. Testing

### Test 1: Verify FCM Token Registration

1. Run your app and login
2. Check logs for: `[FCM] Token registered successfully`
3. Query database:

```sql
SELECT * FROM public.fcm_tokens WHERE user_id = 'YOUR_USER_ID';
```

### Test 2: Send Test Notification

**Option A: Insert a new deal in database:**

```sql
INSERT INTO public.campaigns (
  campaign_id,
  shop_name,
  deal_heading,
  offer_value,
  category,
  city,
  start_date,
  end_date,
  status
) VALUES (
  gen_random_uuid(),
  'Test Store',
  'Test Deal for Notifications',
  '50% Off',
  'Food & Dining',
  'Bangalore',
  NOW(),
  NOW() + INTERVAL '7 days',
  'active'
);
```

**Option B: Call edge function directly:**

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-new-deal-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "record": {
      "campaign_id": "test-123",
      "shop_name": "Test Shop",
      "deal_heading": "Amazing Deal",
      "offer_value": "50% Off",
      "city": "Bangalore",
      "category": "Food & Dining"
    }
  }'
```

### Test 3: Check Notification Delivery

- **Foreground:** Notification should appear in logs
- **Background:** Notification should appear in system tray
- **Killed:** Notification should wake up the app

---

## 7. Troubleshooting

### Common Issues

#### ❌ "No token available to register"

**Solution:**
- Check permissions: `fcmService.hasPermission()`
- Request permissions: `fcmService.requestPermissions()`
- Verify Firebase configuration files are in place

#### ❌ "UPSERT failed: violates foreign key constraint"

**Solution:**
- Ensure user_id exists in auth.users table
- Check that you're passing the correct user ID

#### ❌ "Edge function timeout"

**Solution:**
- Check Supabase function logs: `supabase functions logs send-new-deal-notification`
- Verify environment variables are set correctly
- Check Firebase service account credentials

#### ❌ "Notifications not received on iOS"

**Solution:**
- Verify APNs certificates in Firebase Console
- Check that Push Notifications capability is enabled in Xcode
- Test on a real device (not simulator)

#### ❌ "Invalid FCM token"

**Solution:**
- Token might be expired - implement token refresh
- Check that device type matches (iOS/Android)
- Verify Firebase project configuration

### Debug Commands

```bash
# Check Supabase function logs
supabase functions logs send-new-deal-notification

# Test Firebase credentials
curl -X POST \
  'https://oauth2.googleapis.com/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=YOUR_JWT'

# Check database webhook status
SELECT * FROM supabase_functions.hooks;
```

---

## 🎉 Success Checklist

- [ ] Firebase project created
- [ ] Service account key generated
- [ ] Database table created
- [ ] RLS policies enabled
- [ ] React Native FCM installed
- [ ] Firebase config files added
- [ ] FCM service initialized on login
- [ ] Edge function deployed
- [ ] Environment variables set
- [ ] Database webhook created
- [ ] Test notification sent successfully

---

## 📚 Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [React Native Firebase](https://rnfirebase.io/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

## 🔒 Security Best Practices

1. **Never commit Firebase service account keys to Git**
2. **Use environment variables for sensitive data**
3. **Enable RLS on fcm_tokens table**
4. **Regularly cleanup old/inactive tokens**
5. **Validate user permissions before sending notifications**
6. **Rate limit notification sending to prevent spam**

---

Need help? Check the troubleshooting section or open an issue in the repository.
