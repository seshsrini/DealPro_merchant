/**
 * FCM Service - Firebase Cloud Messaging Integration (Capacitor)
 * Handles push notification token registration and management
 */

import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabaseClient';

interface FCMTokenData {
  device_token: string;
  device_type: 'ios' | 'android' | 'web';
  device_name?: string;
  app_version?: string;
}

class FCMService {
  private currentToken: string | null = null;
  private currentUserId: string | null = null;

  /**
   * Request notification permissions from the user
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const result = await PushNotifications.requestPermissions();

      if (result.receive === 'granted') {
        console.log('[FCM] Permission granted');
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
   * Check current permission status
   */
  async hasPermission(): Promise<boolean> {
    try {
      const result = await PushNotifications.checkPermissions();
      return result.receive === 'granted';
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
      const result = await PushNotifications.checkPermissions();
      return result.receive || 'prompt';
    } catch (error) {
      console.error('[FCM] Error getting permission status:', error);
      return 'error';
    }
  }

  /**
   * Register for push notifications and get token
   */
  async getToken(): Promise<string | null> {
    try {
      // Register with Apple / Google to receive push via APNS/FCM
      await PushNotifications.register();

      // Token will be received via the 'registration' listener
      // For now, return the current token if available
      return this.currentToken;
    } catch (error) {
      console.error('[FCM] Error registering for push:', error);
      return null;
    }
  }

  /**
   * Register the FCM token in Supabase database
   * Uses UPSERT logic to handle token updates
   */
  async registerToken(userId: string): Promise<boolean> {
    try {
      console.log('[FCM] === registerToken() called ===');
      console.log('[FCM] User ID:', userId);
      console.log('[FCM] Current token exists:', !!this.currentToken);

      if (!this.currentToken) {
        console.log('[FCM] ❌ No token available to register');
        return false;
      }

      // Get platform information
      const platform = Capacitor.getPlatform();
      const deviceType = platform === 'ios' || platform === 'android' ? platform : 'web';

      console.log('[FCM] Platform:', platform);
      console.log('[FCM] Device type:', deviceType);

      // Get device/app info
      const deviceName = navigator.userAgent;
      const appVersion = '1.0.0';

      const tokenData: FCMTokenData = {
        device_token: this.currentToken,
        device_type: deviceType,
        device_name: deviceName,
        app_version: appVersion,
      };

      console.log('[FCM] Token data prepared:', {
        device_type: tokenData.device_type,
        app_version: tokenData.app_version,
        token_length: tokenData.device_token.length
      });

      console.log('[FCM] Calling Edge Function to register token...');

      // Use Edge Function to bypass RLS
      const { data, error } = await supabase.functions.invoke('manage-fcm-tokens', {
        body: {
          action: 'register',
          userId: userId,
          deviceToken: tokenData.device_token,
          deviceType: tokenData.device_type,
          deviceName: tokenData.device_name,
          appVersion: tokenData.app_version,
        }
      });

      if (error) {
        console.error('[FCM] ❌ Edge Function error:', error);
        console.error('[FCM] Error details:', JSON.stringify(error, null, 2));
        return false;
      }

      if (!data.success) {
        console.error('[FCM] ❌ Error registering token:', data.error);
        return false;
      }

      console.log('[FCM] ✅ Token registered successfully via Edge Function!');
      console.log('[FCM] Database record ID:', data.tokenId);
      console.log('[FCM] === registerToken() complete ===');
      return true;
    } catch (error: any) {
      console.error('[FCM] ❌ Exception in registerToken:', error);
      console.error('[FCM] Exception message:', error.message);
      console.error('[FCM] Exception stack:', error.stack);
      return false;
    }
  }

  /**
   * Initialize FCM for the current user
   * Call this after successful login
   */
  async initialize(userId: string): Promise<void> {
    try {
      console.log('[FCM] ========================================');
      console.log('[FCM] Initializing FCM for user:', userId);

      // Store userId for later use (e.g., unregister on logout)
      this.currentUserId = userId;

      // Only initialize on native platforms
      const platform = Capacitor.getPlatform();
      console.log('[FCM] Platform detected:', platform);

      if (platform === 'web') {
        console.log('[FCM] Skipping initialization on web platform');
        return;
      }

      console.log('[FCM] Running on native platform, proceeding...');

      // 1. Request permissions
      console.log('[FCM] Requesting notification permissions...');
      const hasPermission = await this.requestPermissions();
      console.log('[FCM] Permission result:', hasPermission);

      if (!hasPermission) {
        console.log('[FCM] User denied notification permissions');
        return;
      }

      // 2. Setup listeners BEFORE registering
      console.log('[FCM] Setting up push notification listeners...');
      this.setupListeners(userId);

      // 3. Register for push notifications
      console.log('[FCM] Calling PushNotifications.register()...');
      await PushNotifications.register();

      console.log('[FCM] Registration call completed');
      console.log('[FCM] Waiting for token from registration listener...');
      console.log('[FCM] ========================================');
    } catch (error) {
      console.error('[FCM] ❌ Error initializing FCM:', error);
      console.error('[FCM] Error details:', JSON.stringify(error, null, 2));
    }
  }

  /**
   * Setup all push notification listeners
   */
  private setupListeners(userId: string): void {
    console.log('[FCM] Setting up listeners for user:', userId);

    // Called when registration is successful
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[FCM] ✅ REGISTRATION LISTENER FIRED!');
      console.log('[FCM] Push registration success, token:', token.value.substring(0, 20) + '...');
      console.log('[FCM] Full token length:', token.value.length);
      this.currentToken = token.value;

      // Register token in database
      console.log('[FCM] Calling registerToken() to save to database...');
      const result = await this.registerToken(userId);
      console.log('[FCM] registerToken() result:', result);
    });

    // Called when registration fails
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[FCM] ❌ REGISTRATION ERROR LISTENER FIRED!');
      console.error('[FCM] Push registration error:', error);
      console.error('[FCM] Error details:', JSON.stringify(error, null, 2));
    });

    // Called when a push notification is received (app in foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('[FCM] Push notification received:', notification);

      // You can display a local notification or update UI here
      console.log('[FCM] Notification:', {
        title: notification.title,
        body: notification.body,
        data: notification.data
      });
    });

    // Called when user taps on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('[FCM] Push notification action performed:', action);

      const notification = action.notification;
      console.log('[FCM] Notification tapped:', {
        title: notification.title,
        body: notification.body,
        data: notification.data
      });

      // Handle notification tap - navigate to specific screen based on data
      // Example: if (notification.data.dealId) { navigateToDeal(notification.data.dealId); }
    });
  }

  /**
   * Unregister the current device token
   * Call this on logout
   */
  async unregisterToken(): Promise<boolean> {
    try {
      if (!this.currentToken || !this.currentUserId) {
        console.log('[FCM] No token or userId to unregister');
        return true;
      }

      // Use Edge Function to mark token as inactive
      const { data, error } = await supabase.functions.invoke('manage-fcm-tokens', {
        body: {
          action: 'unregister',
          userId: this.currentUserId,
          deviceToken: this.currentToken,
        }
      });

      if (error) {
        console.error('[FCM] Edge Function error:', error);
        return false;
      }

      if (!data.success) {
        console.error('[FCM] Error unregistering token:', data.error);
        return false;
      }

      console.log('[FCM] Token unregistered successfully');
      this.currentToken = null;
      this.currentUserId = null;
      return true;
    } catch (error) {
      console.error('[FCM] Error in unregisterToken:', error);
      return false;
    }
  }

  /**
   * Remove all listeners (call on logout/cleanup)
   */
  async cleanup(): Promise<void> {
    try {
      await PushNotifications.removeAllListeners();
      console.log('[FCM] Cleaned up all listeners');
    } catch (error) {
      console.error('[FCM] Error cleaning up:', error);
    }
  }

  /**
   * Get all delivered notifications (iOS only)
   */
  async getDeliveredNotifications(): Promise<any[]> {
    try {
      const result = await PushNotifications.getDeliveredNotifications();
      return result.notifications;
    } catch (error) {
      console.error('[FCM] Error getting delivered notifications:', error);
      return [];
    }
  }

  /**
   * Remove all delivered notifications from notification center
   */
  async removeAllDeliveredNotifications(): Promise<void> {
    try {
      await PushNotifications.removeAllDeliveredNotifications();
      console.log('[FCM] Removed all delivered notifications');
    } catch (error) {
      console.error('[FCM] Error removing notifications:', error);
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
 * await fcmService.cleanup();
 *
 * // Check permission status:
 * const hasPermission = await fcmService.hasPermission();
 * if (!hasPermission) {
 *   const granted = await fcmService.requestPermissions();
 *   if (granted) {
 *     // Permissions granted, initialization will handle token registration
 *   }
 * }
 *
 * // Clear all notifications from notification center:
 * await fcmService.removeAllDeliveredNotifications();
 */
