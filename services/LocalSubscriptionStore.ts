/**
 * LocalSubscriptionStore — IndexedDB-backed local mirror of merchant_subscriptions
 *
 * Keeps a local copy of the subscription record for offline resilience.
 * Records are flagged as 'unsynced' until successfully pushed to Supabase.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { supabase } from './supabaseClient';

// ──────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────

export interface LocalSubscription {
  /** Local auto-increment key */
  localId?: number;
  /** merchant_subscriptions.id from Supabase (null until synced) */
  remoteId: number | null;
  /** Merchant UUID */
  merchantId: string;
  /** Matches tier_name / plan_name in DB (e.g. "Starter", "Growth", "Pro") */
  planName: string;
  /** Subscription status: active, trialing, cancelled, expired */
  status: string;
  /** Google Play purchase token — stored as subscription_id in Supabase */
  purchaseToken: string | null;
  /** Google Play product ID (e.g. dealpro_starter_monthly) */
  productId: string | null;
  /** Trial end date as ISO string */
  trialEnd: string | null;
  /** Billing period start */
  currentPeriodStart: string | null;
  /** Billing period end */
  currentPeriodEnd: string | null;
  /** Recurring amount from subscription_tiers.subscription_fee */
  totalRecurringAmount: number | null;
  /** Whether this record has been synced to Supabase */
  synced: boolean;
  /** Timestamp of last modification */
  updatedAt: string;
}

interface SubscriptionDB extends DBSchema {
  subscriptions: {
    key: number;
    value: LocalSubscription;
    indexes: {
      'by-merchant': string;
      'by-synced': number; // 0 = unsynced, 1 = synced
    };
  };
}

// ──────────────────────────────────────────────
//  Database
// ──────────────────────────────────────────────

const DB_NAME = 'dealpro-subscriptions';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<SubscriptionDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SubscriptionDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SubscriptionDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('subscriptions', {
          keyPath: 'localId',
          autoIncrement: true,
        });
        store.createIndex('by-merchant', 'merchantId');
        store.createIndex('by-synced', 'synced');
      },
    });
  }
  return dbPromise;
}

// ──────────────────────────────────────────────
//  Service
// ──────────────────────────────────────────────

export const localSubscriptionStore = {
  /**
   * Save or update a subscription locally. Marks as unsynced.
   */
  async upsert(record: Omit<LocalSubscription, 'localId' | 'synced' | 'updatedAt'> & { localId?: number }): Promise<number> {
    const db = await getDB();
    const existing = record.localId
      ? await db.get('subscriptions', record.localId)
      : await this.getByMerchant(record.merchantId);

    const entry: LocalSubscription = {
      ...existing,
      ...record,
      localId: existing?.localId ?? record.localId,
      synced: false,
      updatedAt: new Date().toISOString(),
    };

    const key = await db.put('subscriptions', entry);
    console.log('[LocalSubscriptionStore] Upserted subscription, localId:', key, 'synced: false');
    return key;
  },

  /**
   * Get the subscription record for a merchant.
   */
  async getByMerchant(merchantId: string): Promise<LocalSubscription | undefined> {
    const db = await getDB();
    const all = await db.getAllFromIndex('subscriptions', 'by-merchant', merchantId);
    // Return the most recently updated one
    if (all.length === 0) return undefined;
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  },

  /**
   * Get all unsynced records.
   */
  async getUnsynced(): Promise<LocalSubscription[]> {
    const db = await getDB();
    // Index stores boolean but IDB coerces; query by iterating
    const all = await db.getAll('subscriptions');
    return all.filter((r) => !r.synced);
  },

  /**
   * Mark a local record as synced.
   */
  async markSynced(localId: number, remoteId: number): Promise<void> {
    const db = await getDB();
    const record = await db.get('subscriptions', localId);
    if (!record) return;

    record.synced = true;
    record.remoteId = remoteId;
    record.updatedAt = new Date().toISOString();
    await db.put('subscriptions', record);
    console.log('[LocalSubscriptionStore] Marked synced, localId:', localId, 'remoteId:', remoteId);
  },

  /**
   * Push all unsynced records to Supabase via the manage-subscription edge function.
   * Returns the count of successfully synced records.
   */
  async syncToSupabase(): Promise<number> {
    const unsynced = await this.getUnsynced();
    if (unsynced.length === 0) {
      console.log('[LocalSubscriptionStore] Nothing to sync');
      return 0;
    }

    let syncedCount = 0;

    for (const record of unsynced) {
      try {
        const { data, error } = await supabase.functions.invoke('manage-subscription', {
          body: {
            action: 'sync_from_device',
            merchantId: record.merchantId,
            plan_name: record.planName,
            status: record.status,
            purchase_token: record.purchaseToken,
            product_id: record.productId,
            trial_end: record.trialEnd,
            current_period_start: record.currentPeriodStart,
            current_period_end: record.currentPeriodEnd,
            total_recurring_amount: record.totalRecurringAmount,
          },
        });

        if (error) {
          console.error('[LocalSubscriptionStore] Sync failed for localId:', record.localId, error);
          continue;
        }

        if (data?.success && data?.subscriptionId && record.localId) {
          await this.markSynced(record.localId, data.subscriptionId);
          syncedCount++;
        }
      } catch (err) {
        console.error('[LocalSubscriptionStore] Sync exception for localId:', record.localId, err);
      }
    }

    console.log(`[LocalSubscriptionStore] Synced ${syncedCount}/${unsynced.length} records`);
    return syncedCount;
  },

  /**
   * Pull the latest subscription from Supabase and update local store.
   * Useful on app launch to ensure local state matches server.
   */
  async syncFromSupabase(merchantId: string): Promise<LocalSubscription | null> {
    try {
      const { data, error } = await supabase.functions.invoke('merchant-subscription', {
        body: { action: 'fetch', merchantId },
      });

      if (error || !data?.subscription) {
        console.log('[LocalSubscriptionStore] No remote subscription found');
        return null;
      }

      const sub = data.subscription;
      const localId = await this.upsert({
        remoteId: sub.id,
        merchantId,
        planName: sub.plan_name,
        status: sub.status,
        purchaseToken: sub.subscription_id || null,
        productId: null,
        trialEnd: sub.trial_end || null,
        currentPeriodStart: sub.current_period_start || null,
        currentPeriodEnd: sub.current_period_end || null,
        totalRecurringAmount: sub.total_recurring_amount || null,
      });

      // Since this came from server, mark as synced
      const db = await getDB();
      const record = await db.get('subscriptions', localId);
      if (record) {
        record.synced = true;
        record.remoteId = sub.id;
        await db.put('subscriptions', record);
      }

      console.log('[LocalSubscriptionStore] Pulled remote subscription, plan:', sub.plan_name);
      return record || null;
    } catch (err) {
      console.error('[LocalSubscriptionStore] Pull from Supabase failed:', err);
      return null;
    }
  },

  /**
   * Clear all local subscription data (e.g. on logout).
   */
  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear('subscriptions');
    console.log('[LocalSubscriptionStore] Cleared all local records');
  },
};
