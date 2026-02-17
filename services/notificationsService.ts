/**
 * Notifications Service
 * Handles fetching and managing user_notifications for consumers
 * Routes all calls through the fetch-notifications Edge Function (service role key bypasses RLS)
 */

import { supabase } from './supabaseClient';

export interface UserNotification {
  id: string;
  user_id: string;
  campaign_id: string | null;
  merchant_id: string | null;
  type: string;
  title: string;
  body: string;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
}

class NotificationsService {
  /**
   * Fetch unread notifications for a consumer
   */
  async getUnreadNotifications(userId: string): Promise<UserNotification[]> {
    const { data, error } = await supabase.functions.invoke('fetch-notifications', {
      body: { action: 'fetch', userId },
    });

    if (error) {
      console.error('[NotificationsService] Error fetching unread notifications:', error.message);
      return [];
    }

    if (!data?.success) {
      console.error('[NotificationsService] fetch-notifications returned failure:', data?.error);
      return [];
    }

    return data.notifications ?? [];
  }

  /**
   * Get unread notification count for a consumer
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { data, error } = await supabase.functions.invoke('fetch-notifications', {
      body: { action: 'count', userId },
    });

    if (error) {
      console.error('[NotificationsService] Error fetching unread count:', error.message);
      return 0;
    }

    if (!data?.success) {
      console.error('[NotificationsService] fetch-notifications count returned failure:', data?.error);
      return 0;
    }

    return data.count ?? 0;
  }

  /**
   * Mark all unread notifications as read for a consumer
   */
  async markAllRead(userId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('fetch-notifications', {
      body: { action: 'mark-read', userId },
    });

    if (error) {
      console.error('[NotificationsService] Error marking notifications as read:', error.message);
      return;
    }

    if (!data?.success) {
      console.error('[NotificationsService] fetch-notifications mark-read returned failure:', data?.error);
    }
  }

  /**
   * Save push notification consent for a consumer
   */
  async updatePushConsent(userId: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('update-pushnotify-consent', {
      body: { userId },
    });

    if (error) {
      console.error('[NotificationsService] Error updating push consent:', error.message);
      return;
    }

    if (!data?.success) {
      console.error('[NotificationsService] update-pushnotify-consent returned failure:', data?.error);
    }
  }
}

export const notificationsService = new NotificationsService();
