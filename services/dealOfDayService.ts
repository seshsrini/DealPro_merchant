
import { supabase } from "./supabaseClient";
import { addCampaignService } from "./addCampaignService";

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

    // Delegate to the hardened campaign creator: it carries the idempotency key
    // + transient-retry logic so a DOTD publish never fails on a network blip /
    // cold start / transient 5xx, and it preserves the moderation-field metadata
    // (isModerationBlock / moderationField) that the wizard uses to highlight the
    // offending field.
    return addCampaignService.createCampaign(payload);
  },

  /**
   * Upload image for Deal of the Day.
   * Delegates to the SAME Cloudinary path regular campaigns use, so DOTD images
   * live alongside campaign images in Cloudinary. Previously this called the
   * `upload-deal-image` edge function, which writes to a Supabase Storage bucket —
   * inconsistent with everything else and requiring a STORAGE_BUCKET_NAME secret.
   */
  uploadDealImage: async (merchantId: string, file: File): Promise<{ publicUrl: string, imageName: string }> => {
    return addCampaignService.uploadDealImage(merchantId, file);
  },
};
