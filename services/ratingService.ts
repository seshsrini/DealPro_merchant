import { supabase } from './supabaseClient';

export interface PendingFeedbackClaim {
  interaction_id: string;
  campaign_id: string;
  merchant_id: string;
  consumer_id: string;
  claim_no: string;
  is_redeemed: boolean;
  campaign_details: {
    shop_name: string;
    deal_heading: string;
    offer_value: string;
    image_url: string;
    long_description: string;
    localized_heading: Record<string, string>;
    localized_offer: Record<string, string>;
    localized_shop_name: Record<string, string>;
    endDate?: string;
  };
}

export const ratingService = {
  /**
   * Fetches pending feedback claims (redeemed but not yet rated)
   * @param userId The consumer's user ID
   * @returns Array of pending claims that need ratings
   */
  getPendingFeedbackClaims: async (userId: string): Promise<PendingFeedbackClaim[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-pending-feedback-claims', {
        body: { userId },
      });

      if (error) {
        console.error('[ratingService] Failed to fetch pending feedback claims:', error);
        throw error;
      }

      return data || [];
    } catch (error: any) {
      console.error('[ratingService] Error fetching pending feedback claims:', error);
      throw error;
    }
  },

  /**
   * Submits a rating for a redeemed campaign
   * @param interactionId The interaction ID from campaign_interactions
   * @param rating Rating value (1-5)
   * @param comments Optional comments
   */
  submitRating: async (interactionId: string, rating: number, comments: string): Promise<void> => {
    try {
      console.log('[ratingService] Submitting rating:', { interactionId, rating, comments });

      const { data, error } = await supabase.functions.invoke('update-feedback', {
        body: { interactionId, rating, comments },
      });

      if (error) {
        console.error('[ratingService] Failed to submit rating:', error);
        // Try to extract the actual error message from the response
        const errorMsg = (error as any)?.message || error?.toString() || 'Failed to submit rating';
        throw new Error(errorMsg);
      }

      // Check if data contains an error
      if (data && typeof data === 'object' && 'error' in data) {
        console.error('[ratingService] Edge Function returned error:', data.error);
        throw new Error(data.error);
      }

      console.log('[ratingService] Rating submitted successfully:', data);
      return data;
    } catch (error: any) {
      console.error('[ratingService] Error submitting rating:', error);
      throw error;
    }
  },
};
