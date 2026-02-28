/**
 * Smart Notifications Service
 * Generates intelligent, actionable notifications for merchants
 * based on analytics, trends, and product performance
 *
 * REFACTORED: Now uses Supabase Edge Functions instead of direct client queries
 */

import { supabase } from './supabaseClient';

export interface SmartNotification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'urgent';
  title: string;
  message: string;
  actionText?: string;
  actionRoute?: string;
  icon: string;
  priority: number; // 1-5, 5 being highest
  timestamp: Date;
}

export const notificationInsightsService = {
  /**
   * Get all smart notifications for a merchant
   * Calls the get-smart-notifications Edge Function
   */
  async getAllSmartNotifications(merchantId: string): Promise<SmartNotification[]> {
    try {
      const { data, error } = await supabase.functions.invoke('get-smart-notifications', {
        body: { merchantId },
      });

      if (error) throw error;

      // Parse timestamp strings back to Date objects
      const notifications = (data?.notifications || []).map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp),
      }));

      return notifications;
    } catch (error: any) {
      // Silently handle — EF may fail if products table doesn't exist yet
      console.warn('[notificationInsightsService] Smart notifications unavailable:', error?.message || 'unknown error');
      return [];
    }
  },
};
