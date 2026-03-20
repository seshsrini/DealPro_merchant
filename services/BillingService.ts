/**
 * BillingService — Google Play Billing via cordova-plugin-purchase (CdvPurchase)
 *
 * Wraps CdvPurchase.Store for in-app subscription purchases on Android.
 * On web/browser, all methods are safe no-ops.
 */

import { Capacitor } from '@capacitor/core';
import { localSubscriptionStore } from './LocalSubscriptionStore';
import { supabase } from './supabaseClient';

// CdvPurchase is loaded onto `window` by cordova-plugin-purchase at runtime
interface CdvPurchaseStore {
  Platform: { GOOGLE_PLAY: string };
  ProductType: { PAID_SUBSCRIPTION: string };
  register: (products: Array<{ id: string; type: string; platform: string }>) => void;
  initialize: (platforms?: string[]) => Promise<void>;
  get: (productId: string, platform?: string) => any;
  order: (offer: any) => Promise<any>;
  restorePurchases: () => Promise<void>;
  when: () => {
    approved: (cb: (transaction: any) => void) => any;
    verified: (cb: (receipt: any) => void) => any;
    finished: (cb: (transaction: any) => void) => any;
    updated: (cb: (product: any) => void) => any;
  };
  ready: (cb: () => void) => void;
}

declare global {
  interface Window {
    CdvPurchase?: { store: CdvPurchaseStore };
  }
}

// Subscription product IDs — must match Google Play Console
export const PRODUCT_IDS = {
  STARTER: 'dealpro_starter_monthly',
  GROWTH: 'dealpro_growth_monthly',
  PRO: 'dealpro_pro_monthly',
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

export interface BillingProduct {
  id: string;
  title: string;
  description: string;
  price: string;       // Formatted price e.g. "₹299.00"
  priceMicros: number; // Price in micros (e.g. 299000000)
  currency: string;
  owned: boolean;
}

class BillingService {
  private store: CdvPurchaseStore | null = null;
  private initialized = false;
  private isNative: boolean;
  private merchantId: string | null = null;
  private pendingSubscriptionFee: number | null = null;
  private onPurchaseComplete: ((success: boolean, planName: string, purchaseToken: string | null) => void) | null = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  /**
   * Set the current merchant ID (call after login).
   */
  setMerchantId(merchantId: string): void {
    this.merchantId = merchantId;
  }

  /**
   * Register a callback for when a purchase completes (verified + saved to local store).
   */
  onPurchaseCompleted(cb: (success: boolean, planName: string, purchaseToken: string | null) => void): void {
    this.onPurchaseComplete = cb;
  }

  /**
   * Set the subscription fee to associate with the next purchase.
   */
  setPendingFee(fee: number): void {
    this.pendingSubscriptionFee = fee;
  }

  /**
   * Initialize the billing store and register products.
   * Safe to call on web — returns immediately.
   */
  async initialize(): Promise<boolean> {
    if (!this.isNative) {
      console.log('[BillingService] Not a native platform, skipping initialization');
      return false;
    }

    if (this.initialized) return true;

    // Wait for CdvPurchase to be available (plugin loads async)
    const store = await this.waitForStore();
    if (!store) {
      console.error('[BillingService] CdvPurchase.store not available');
      return false;
    }

    this.store = store;

    // Register all subscription products
    const products = Object.values(PRODUCT_IDS).map((id) => ({
      id,
      type: store.ProductType.PAID_SUBSCRIPTION,
      platform: store.Platform.GOOGLE_PLAY,
    }));

    store.register(products);

    // Set up purchase lifecycle handlers
    store.when()
      .approved((transaction: any) => {
        console.log('[BillingService] Purchase approved:', transaction.transactionId);
        transaction.verify();
      })
      .verified((receipt: any) => {
        console.log('[BillingService] Purchase verified:', receipt.id);
        if (this.merchantId) {
          const productId = receipt.products?.[0]?.id || null;
          const planName = this.productIdToPlanName(productId);
          const token = receipt.purchaseToken || receipt.transactionId || null;

          // 1. Save to local IndexedDB immediately (offline-safe)
          localSubscriptionStore.upsert({
            remoteId: null,
            merchantId: this.merchantId,
            planName,
            status: 'active',
            purchaseToken: token,
            productId,
            trialEnd: null,
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: null,
            totalRecurringAmount: this.pendingSubscriptionFee,
          }).then(() => {
            console.log('[BillingService] Saved to local store (unsynced)');
          });

          // 2. Call verify-play-purchase edge function for server-side verification
          supabase.functions.invoke('verify-play-purchase', {
            body: {
              merchant_id: this.merchantId,
              purchaseToken: token,
              product_id: productId,
              plan_name: planName,
            },
          }).then(({ data, error }) => {
            if (error) {
              console.error('[BillingService] Server verification failed, will retry via sync:', error);
            } else if (data?.success && data?.subscriptionId) {
              console.log('[BillingService] Server verification succeeded, subscriptionId:', data.subscriptionId);
              // Mark local record as synced
              localSubscriptionStore.getByMerchant(this.merchantId!).then((local) => {
                if (local?.localId) {
                  localSubscriptionStore.markSynced(local.localId, data.subscriptionId);
                }
              });
            }
            // Notify listeners regardless
            if (this.onPurchaseComplete) {
              this.onPurchaseComplete(true, planName, token);
            }
          }).catch((err) => {
            console.error('[BillingService] Server verification exception:', err);
            // Still notify — local store has the record for retry
            if (this.onPurchaseComplete) {
              this.onPurchaseComplete(true, planName, token);
            }
          });

          this.pendingSubscriptionFee = null;
        }
        receipt.finish();
      })
      .finished((transaction: any) => {
        console.log('[BillingService] Purchase finished:', transaction.transactionId);
      });

    await store.initialize([store.Platform.GOOGLE_PLAY]);
    this.initialized = true;
    console.log('[BillingService] Store initialized successfully');
    return true;
  }

  /**
   * Get product details for a given product ID.
   */
  getProduct(productId: ProductId): BillingProduct | null {
    if (!this.store) return null;

    const product = this.store.get(productId, this.store.Platform.GOOGLE_PLAY);
    if (!product) return null;

    const offer = product.offers?.[0];
    const pricingPhase = offer?.pricingPhases?.[0];

    return {
      id: product.id,
      title: product.title || '',
      description: product.description || '',
      price: pricingPhase?.price || '',
      priceMicros: pricingPhase?.priceMicros || 0,
      currency: pricingPhase?.currency || 'INR',
      owned: product.owned || false,
    };
  }

  /**
   * Get all registered products.
   */
  getAllProducts(): BillingProduct[] {
    return Object.values(PRODUCT_IDS)
      .map((id) => this.getProduct(id as ProductId))
      .filter((p): p is BillingProduct => p !== null);
  }

  /**
   * Launch the purchase flow for a product.
   * Automatically selects the free trial offer if available (120-day trial).
   */
  async purchase(productId: ProductId): Promise<{ success: boolean; error?: string; purchaseToken?: string }> {
    if (!this.store) {
      return { success: false, error: 'Billing not initialized' };
    }

    const product = this.store.get(productId, this.store.Platform.GOOGLE_PLAY);
    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    // Prefer the free trial offer — look for an offer with a free pricing phase
    const offers = product.offers || [];
    const trialOffer = offers.find((o: any) =>
      o.pricingPhases?.some((phase: any) =>
        phase.price === '₹0.00' || phase.priceMicros === 0 || phase.paymentMode === 'FreeTrial'
      )
    );
    const selectedOffer = trialOffer || offers[0];

    if (!selectedOffer) {
      return { success: false, error: 'No offer available for this product' };
    }

    console.log('[BillingService] Ordering with offer:', trialOffer ? 'FREE_TRIAL' : 'DEFAULT', selectedOffer.id);

    try {
      await this.store.order(selectedOffer);
      return { success: true };
    } catch (err: any) {
      console.error('[BillingService] Purchase error:', err);
      return { success: false, error: err?.message || 'Purchase failed' };
    }
  }

  /**
   * Restore previous purchases (e.g. after reinstall).
   */
  async restorePurchases(): Promise<void> {
    if (!this.store) return;
    await this.store.restorePurchases();
    console.log('[BillingService] Purchases restored');
  }

  /**
   * Check if a specific product is currently owned/active.
   */
  isSubscriptionActive(productId: ProductId): boolean {
    if (!this.store) return false;
    const product = this.store.get(productId, this.store.Platform.GOOGLE_PLAY);
    return product?.owned === true;
  }

  /**
   * Check if any DealPro subscription is active.
   */
  hasActiveSubscription(): boolean {
    return Object.values(PRODUCT_IDS).some((id) =>
      this.isSubscriptionActive(id as ProductId)
    );
  }

  /**
   * Map tier_key from subscription_tiers table to Google Play product ID.
   */
  tierKeyToProductId(tierKey: string): ProductId | null {
    const map: Record<string, ProductId> = {
      starter: PRODUCT_IDS.STARTER,
      growth: PRODUCT_IDS.GROWTH,
      pro: PRODUCT_IDS.PRO,
    };
    return map[tierKey.toLowerCase()] || null;
  }

  /**
   * Map Google Play product ID to plan name used in Supabase.
   */
  productIdToPlanName(productId: string | null): string {
    switch (productId) {
      case PRODUCT_IDS.STARTER: return 'Starter';
      case PRODUCT_IDS.GROWTH: return 'Growth';
      case PRODUCT_IDS.PRO: return 'Pro';
      default: return 'Unknown';
    }
  }

  /**
   * Wait for the CdvPurchase plugin to load onto window.
   */
  private waitForStore(timeoutMs = 5000): Promise<CdvPurchaseStore | null> {
    return new Promise((resolve) => {
      if (window.CdvPurchase?.store) {
        resolve(window.CdvPurchase.store);
        return;
      }

      const start = Date.now();
      const interval = setInterval(() => {
        if (window.CdvPurchase?.store) {
          clearInterval(interval);
          resolve(window.CdvPurchase.store);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          console.warn('[BillingService] Timed out waiting for CdvPurchase');
          resolve(null);
        }
      }, 100);
    });
  }
}

// Singleton export
export const billingService = new BillingService();
