
import { supabase } from "./supabaseClient";

export const dealOfDayService = {
  /**
   * Creates a Deal of the Day campaign
   * Ensures is_deal_of_the_day is set to TRUE
   */
  createDealOfDay: async (
    merchantId: string,
    campaignData: {
      shop_name: string;
      deal_heading: string;
      offer_value: string;
      category: string;
      start_date: string;
      end_date: string;
      long_description: string;
      store_id: string;
      image_url: string;
      image_name: string;
      latlong: string;
      media_urls?: string[];
      video_url?: string;
      image_price_overlays?: Record<string, { discountPct: string; offerPrice: string }>;
      trust_badges?: string[];
      free_gifts?: { image_url: string; name: string }[];
      localized_heading?: any;
      localized_offer?: any;
      localized_description?: any;
      localized_shop_name?: any;
      [key: string]: any;
    }
  ) => {
    // Explicitly ensure is_deal_of_the_day is TRUE and include merchant_id
    const payload = {
      ...campaignData,
      merchant_id: merchantId, // Required for authorization
      is_deal_of_the_day: true, // Force this to TRUE for Deal of the Day
    };

    console.log('[dealOfDayService] Creating Deal of the Day with payload:', payload);

    const { data, error } = await supabase.functions.invoke('create-campaign', {
      body: payload,
    });

    if (error) {
      console.error('[dealOfDayService] Failed to create Deal of the Day:', error);
      // Try to extract moderation field info from the error response body
      try {
        const body = await (error as any).context?.json?.();
        if (body?.moderation?.field) {
          const modErr = new Error(body.error || 'Content moderation failed') as any;
          modErr.isModerationBlock = true;
          modErr.moderationField = body.moderation.field;
          throw modErr;
        }
        if (body?.error) throw new Error(body.error);
      } catch (parseErr: any) {
        if (parseErr.isModerationBlock) throw parseErr;
      }
      throw new Error('Unable to process deal. Please try again.');
    }

    console.log('[dealOfDayService] Successfully created Deal of the Day:', data);
    return data;
  },

  /**
   * Upload image for Deal of the Day
   * Reuses the same upload functionality as regular campaigns
   */
  uploadDealImage: async (merchantId: string, file: File): Promise<{ publicUrl: string, imageName: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('merchantId', merchantId);

    const { data, error } = await supabase.functions.invoke('upload-deal-image', {
      body: formData,
    });

    if (error) {
      console.error('[dealOfDayService] Failed to upload image:', error);
      throw new Error('Unable to process deal. Please try again.');
    }

    return data as { publicUrl: string, imageName: string };
  },
};
