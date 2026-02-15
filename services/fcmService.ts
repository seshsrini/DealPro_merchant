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
            onConflict: 'device_token', // Use device_token as the conflict target
            ignoreDuplicates: false, // Update if exists
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

      // Update token in database
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

/**
 * USAGE EXAMPLE:
 *
 * // After successful login:
 * import { fcmService } from './services/fcmService';
 *
 * const user = await userService.loginUser(username, password);
 * await fcmService.initialize(user.id);
 *
 * // On logout:
 * await fcmService.unregisterToken();
 *
 * // Check permission status:
 * const hasPermission = await fcmService.hasPermission();
 * if (!hasPermission) {
 *   const granted = await fcmService.requestPermissions();
 *   if (granted) {
 *     await fcmService.registerToken(userId);
 *   }
 * }
 */
