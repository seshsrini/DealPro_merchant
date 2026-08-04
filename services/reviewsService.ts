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
   * Fetch the merchant's rating aggregate + a page of written reviews.
   * First call: offset 0, limit 10. "Show more": offset = loaded count, limit 20.
   */
  async getMerchantReviews(merchantId: string, offset = 0, limit = 10): Promise<MerchantReviews | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-merchant-reviews', {
        body: { merchant_id: merchantId, offset, limit },
      });
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
