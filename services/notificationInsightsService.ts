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

// ── Persisted read-state for smart notifications ────────────────────────────
// The bell badge must reflect only UNREAD insights. Smart-notification ids are
// stable (e.g. 'low-inventory', 'peak-time', 'high-performer-<productId>'), so we
// persist the set of ids the merchant has already seen. Opening the alerts panel
// marks all current ids read → the badge clears and STAYS clear. A brand-new
// insight (new id) re-badges; an alert that resolves then recurs also re-badges
// (its id is pruned once it disappears). localStorage keeps it robust across app
// restarts — the previous behaviour recomputed the count from scratch every time,
// so it could never reach zero.
const READ_KEY = (merchantId: string) => `dealpro_read_notifs_${merchantId}`;

export const notificationReadState = {
  getReadIds(merchantId: string): Set<string> {
    try {
      const raw = localStorage.getItem(READ_KEY(merchantId));
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set<string>();
    }
  },
  markRead(merchantId: string, ids: string[]): void {
    try {
      const set = this.getReadIds(merchantId);
      let changed = false;
      for (const id of ids) if (id && !set.has(id)) { set.add(id); changed = true; }
      if (changed) localStorage.setItem(READ_KEY(merchantId), JSON.stringify([...set]));
    } catch { /* ignore */ }
  },
  // Drop read-ids whose insight no longer exists, so a resolved-then-recurring
  // alert counts as unread again next time it appears.
  prune(merchantId: string, currentIds: string[]): void {
    try {
      const set = this.getReadIds(merchantId);
      const cur = new Set(currentIds);
      const kept = [...set].filter((id) => cur.has(id));
      if (kept.length !== set.size) localStorage.setItem(READ_KEY(merchantId), JSON.stringify(kept));
    } catch { /* ignore */ }
  },
  unreadCount(merchantId: string, notifications: { id: string }[]): number {
    const read = this.getReadIds(merchantId);
    return notifications.filter((n) => !read.has(n.id)).length;
  },
};

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

      if (error) throw new Error('Unable to load notifications. Please try again.');
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
