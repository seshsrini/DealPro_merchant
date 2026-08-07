import { supabase } from './supabaseClient';

export interface MerchantReview {
  rating: number;
  comments: string;
  created_at: string;
}

export interface MerchantReviews {
  average: number;
  total: number;                     // total ratings (with or without a comment)
  breakdown: Record<string, number>; // { '1': n, ... '5': n }
  reviews: MerchantReview[];         // this page of written reviews
  comment_total: number;             // total written reviews
  has_more: boolean;
}

export const reviewsService = {
  /**
   * Fetch a STORE's rating aggregate + a page of written reviews (ratings are
   * store-specific). Pass { storeId } for a store; { merchantId } is a fallback for
   * older data / callers with no store. First call: offset 0, limit 10.
   * "Show more": offset = loaded count, limit 20.
   */
  async getMerchantReviews(
    scope: { storeId?: string | null; merchantId?: string | null } | string,
    offset = 0,
    limit = 10,
  ): Promise<MerchantReviews | null> {
    // Back-compat: a bare string is treated as a merchantId.
    const s = typeof scope === 'string' ? { merchantId: scope } : scope;
    const body: Record<string, unknown> = { offset, limit };
    if (s.storeId) body.store_id = s.storeId;
    else if (s.merchantId) body.merchant_id = s.merchantId;
    else return null;
    try {
      const { data, error } = await supabase.functions.invoke('get-merchant-reviews', { body });
      if (error || !data || (data as any).error) {
        console.warn('[reviewsService] getMerchantReviews failed:', error || (data as any)?.error);
        return null;
      }
      return data as MerchantReviews;
    } catch (e) {
      console.warn('[reviewsService] getMerchantReviews exception:', e);
      return null;
    }
  },
};
