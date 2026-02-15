# FCM Installation for Bare React Native (Non-Expo)

Since this is a **bare React Native project** (not Expo), follow these installation steps:

---

## 📦 Step 1: Install Dependencies

```bash
# Install React Native Firebase packages
npm install @react-native-firebase/app @react-native-firebase/messaging

# Install device info package (for fcmService)
npm install react-native-device-info

# Link native dependencies (for React Native < 0.60)
# For RN >= 0.60, autolinking handles this automatically
cd ios && pod install && cd ..
```

---

## 📝 Step 2: Update fcmService.ts

Replace the Expo imports with React Native Device Info:

```typescript
// Replace this import:
// import * as Device from 'expo-device';
// import Constants from 'expo-constants';

// With these:
import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';
```

Then update the device info collection in `registerToken` method:

```typescript
// OLD (Expo version):
const deviceName = Device.deviceName || `${Device.manufacturer} ${Device.modelName}`;
const appVersion = Constants.expoConfig?.version || '1.0.0';

// NEW (Bare RN version):
const deviceName = await DeviceInfo.getDeviceName();
const appVersion = DeviceInfo.getVersion();
```

---

## 🔧 Step 3: Configure Android

### 3.1 Update `android/build.gradle`

```gradle
buildscript {
  ext {
    buildToolsVersion = "33.0.0"
    minSdkVersion = 21
    compileSdkVersion = 33
    targetSdkVersion = 33
  }
  repositories {
    google()
    mavenCentral()
  }
  dependencies {
    classpath("com.android.tools.build:gradle:7.4.2")
    classpath("com.facebook.react:react-native-gradle-plugin")

    // Add this line for Firebase
    classpath 'com.google.gms:google-services:4.4.0'
  }
}
```

### 3.2 Update `android/app/build.gradle`

Add at the **bottom** of the file:

```gradle
apply plugin: 'com.google.gms.google-services'
```

### 3.3 Add `google-services.json`

1. Download from Firebase Console
2. Place in `android/app/google-services.json`

### 3.4 Update `android/app/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  <!-- Add permissions -->
  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

  <application
    android:name=".MainApplication"
    android:label="@string/app_name"
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:allowBackup="false"
    android:theme="@style/AppTheme">

    <!-- Add notification metadata -->
    <meta-data
      android:name="com.google.firebase.messaging.default_notification_icon"
      android:resource="@drawable/ic_notification" />

    <meta-data
      android:name="com.google.firebase.messaging.default_notification_color"
      android:resource="@color/notification_color" />

    <!-- Existing activity config -->
    <activity
      android:name=".MainActivity"
      ...>
    </activity>
  </application>
</manifest>
```

### 3.5 Create notification icon

Create a small notification icon at:
`android/app/src/main/res/drawable/ic_notification.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zM12,18c-3.31,0 -6,-2.69 -6,-6s2.69,-6 6,-6 6,2.69 6,6 -2.69,6 -6,6z"/>
</vector>
```

### 3.6 Add notification color

In `android/app/src/main/res/values/colors.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="notification_color">#FFA500</color>
</resources>
```

---

## 🍎 Step 4: Configure iOS

### 4.1 Add `GoogleService-Info.plist`

1. Download from Firebase Console
2. Open Xcode: `open ios/YourApp.xcworkspace`
3. Drag `GoogleService-Info.plist` into the project (ensure "Copy items if needed" is checked)

### 4.2 Update `ios/Podfile`

```ruby
platform :ios, '13.4'

# Add this at the top
use_frameworks! :linkage => :static

target 'YourApp' do
  config = use_native_modules!

  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => true,
    :fabric_enabled => false,
  )

  # Add Firebase pods
  pod 'Firebase/Messaging'

  target 'YourAppTests' do
    inherit! :complete
  end

  post_install do |installer|
    react_native_post_install(installer)
  end
end
```

Then run:

```bash
cd ios
pod install
cd ..
```

### 4.3 Update `ios/YourApp/AppDelegate.mm`

```objc
#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <Firebase.h>  // Add this

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Add this Firebase configuration
  if ([FIRApp defaultApp] == nil) {
    [FIRApp configure];
  }

  self.moduleName = @"YourApp";
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
```

### 4.4 Enable Push Notifications in Xcode

1. Open `ios/YourApp.xcworkspace` in Xcode
2. Select your app target
3. Go to **Signing & Capabilities**
4. Click **+ Capability**
5. Add **Push Notifications**
6. Add **Background Modes**
   - Check "Remote notifications"

### 4.5 Request Notification Permissions (iOS specific)

iOS requires explicit permission request in `Info.plist`. Add:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

---

## 🔄 Step 5: Update fcmService.ts for Bare React Native

Replace the current [fcmService.ts](C:\Srini\dealpro\dev\dealpro\services\fcmService.ts) with this updated version:

```typescript
/**
 * FCM Service - Firebase Cloud Messaging Integration (Bare React Native)
 * Handles push notification token registration and management
 */

import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { supabase } from '../supabaseClient';
import DeviceInfo from 'react-native-device-info';

interface FCMTokenData {
  device_token: string;
  device_type: 'ios' | 'android' | 'web';
  device_name?: string;
  app_version?: string;
}

class FCMService {
  private currentToken: string | null = null;

  /**
   * Request notification permissions from the user
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('[FCM] Permission granted:', authStatus);
        return true;
      } else {
        console.log('[FCM] Permission denied');
        return false;
      }
    } catch (error) {
      console.error('[FCM] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Get the FCM token for this device
   */
  async getToken(): Promise<string | null> {
    try {
      // For iOS, check permission first
      if (Platform.OS === 'ios') {
        const hasPermission = await messaging().hasPermission();
        if (!hasPermission) {
          console.log('[FCM] No permission to get token');
          return null;
        }
      }

      const token = await messaging().getToken();
      this.currentToken = token;
      console.log('[FCM] Token retrieved:', token.substring(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('[FCM] Error getting token:', error);
      return null;
    }
  }

  /**
   * Register the FCM token in Supabase database
   * Uses UPSERT logic to handle token updates
   */
  async registerToken(userId: string): Promise<boolean> {
    try {
      // Get the FCM token
      const token = await this.getToken();
      if (!token) {
        console.log('[FCM] No token available to register');
        return false;
      }

      // Prepare device information using react-native-device-info
      const deviceType = Platform.OS as 'ios' | 'android' | 'web';
      const deviceName = await DeviceInfo.getDeviceName();
      const appVersion = DeviceInfo.getVersion();

      const tokenData: FCMTokenData = {
        device_token: token,
        device_type: deviceType,
        device_name: deviceName,
        app_version: appVersion,
      };

      // UPSERT: Insert new token or update existing one
      const { data, error } = await supabase
        .from('fcm_tokens')
        .upsert(
          {
            user_id: userId,
            ...tokenData,
            is_active: true,
            last_used_at: new Date().toISOString(),
          },
          {
            onConflict: 'device_token',
            ignoreDuplicates: false,
          }
        )
        .select()
        .single();

      if (error) {
        console.error('[FCM] Error registering token:', error);
        return false;
      }

      console.log('[FCM] Token registered successfully:', data.id);
      return true;
    } catch (error) {
      console.error('[FCM] Error in registerToken:', error);
      return false;
    }
  }

  /**
   * Initialize FCM for the current user
   * Call this after successful login
   */
  async initialize(userId: string): Promise<void> {
    try {
      console.log('[FCM] Initializing FCM for user:', userId);

      // 1. Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('[FCM] User denied notification permissions');
        return;
      }

      // 2. Register token
      await this.registerToken(userId);

      // 3. Listen for token refresh
      this.setupTokenRefreshListener(userId);

      // 4. Setup foreground notification handler
      this.setupForegroundNotificationHandler();

      // 5. Setup background handler
      this.setupBackgroundHandler();

      console.log('[FCM] Initialization complete');
    } catch (error) {
      console.error('[FCM] Error initializing FCM:', error);
    }
  }

  /**
   * Listen for token refresh and update in database
   */
  private setupTokenRefreshListener(userId: string): void {
    messaging().onTokenRefresh(async (newToken) => {
      console.log('[FCM] Token refreshed:', newToken.substring(0, 20) + '...');
      this.currentToken = newToken;
      await this.registerToken(userId);
    });
  }

  /**
   * Handle notifications when app is in foreground
   */
  private setupForegroundNotificationHandler(): void {
    messaging().onMessage(async (remoteMessage) => {
      console.log('[FCM] Foreground notification received:', remoteMessage);

      if (remoteMessage.notification) {
        console.log('[FCM] Notification:', {
          title: remoteMessage.notification.title,
          body: remoteMessage.notification.body,
        });

        // You can display a local notification here or update UI
        // Example: Alert.alert(remoteMessage.notification.title, remoteMessage.notification.body);
      }
    });
  }

  /**
   * Setup background message handler
   */
  private setupBackgroundHandler(): void {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('[FCM] Background notification received:', remoteMessage);
    });
  }

  /**
   * Unregister the current device token
   * Call this on logout
   */
  async unregisterToken(): Promise<boolean> {
    try {
      if (!this.currentToken) {
        console.log('[FCM] No token to unregister');
        return true;
      }

      // Mark token as inactive instead of deleting
      const { error } = await supabase
        .from('fcm_tokens')
        .update({ is_active: false })
        .eq('device_token', this.currentToken);

      if (error) {
        console.error('[FCM] Error unregistering token:', error);
        return false;
      }

      console.log('[FCM] Token unregistered successfully');
      this.currentToken = null;
      return true;
    } catch (error) {
      console.error('[FCM] Error in unregisterToken:', error);
      return false;
    }
  }

  /**
   * Delete the FCM token from Firebase (optional, for complete cleanup)
   */
  async deleteToken(): Promise<boolean> {
    try {
      await messaging().deleteToken();
      console.log('[FCM] Token deleted from Firebase');
      return true;
    } catch (error) {
      console.error('[FCM] Error deleting token:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async hasPermission(): Promise<boolean> {
    try {
      const authStatus = await messaging().hasPermission();
      return (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      );
    } catch (error) {
      console.error('[FCM] Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get notification permission status as string
   */
  async getPermissionStatus(): Promise<string> {
    try {
      const authStatus = await messaging().hasPermission();
      switch (authStatus) {
        case messaging.AuthorizationStatus.AUTHORIZED:
          return 'authorized';
        case messaging.AuthorizationStatus.DENIED:
          return 'denied';
        case messaging.AuthorizationStatus.NOT_DETERMINED:
          return 'not_determined';
        case messaging.AuthorizationStatus.PROVISIONAL:
          return 'provisional';
        default:
          return 'unknown';
      }
    } catch (error) {
      console.error('[FCM] Error getting permission status:', error);
      return 'error';
    }
  }
}

// Export singleton instance
export const fcmService = new FCMService();
```

---

## ✅ Installation Complete!

Now run:

```bash
# For Android
npm run android

# For iOS
npm run ios
```

---

## 🧪 Quick Test

After installation, test if FCM is working:

```typescript
// In your App.tsx or login screen
import { fcmService } from './services/fcmService';

// Test permission
const testFCM = async () => {
  const hasPermission = await fcmService.hasPermission();
  console.log('Has permission:', hasPermission);

  if (!hasPermission) {
    const granted = await fcmService.requestPermissions();
    console.log('Permission granted:', granted);
  }

  const token = await fcmService.getToken();
  console.log('FCM Token:', token);
};

testFCM();
```

---

## 📚 Next Steps

1. ✅ Install dependencies (completed above)
2. ✅ Configure Android & iOS
3. ⏭️ Continue with [FCM_SETUP_GUIDE.md](./FCM_SETUP_GUIDE.md) from Step 3 onwards
4. ⏭️ Set up Supabase Edge Function
5. ⏭️ Create database webhook

---

All set for bare React Native! 🚀
