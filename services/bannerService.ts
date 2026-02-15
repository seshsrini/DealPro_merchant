import { supabase } from './supabaseClient';

export interface BannerUpdateData {
  topic: string;
  heading: string;
  description: string;
  images: string[];
}

/**
 * Banner Service
 * Handles updating banner/hoarding data for marketing displays
 */
export const bannerService = {
  /**
   * Update a specific banner by hoarding number
   */
  async updateBanner(hoarding_no: number, data: BannerUpdateData): Promise<{ success: boolean; error: any }> {
    try {
      console.log('[bannerService] Updating banner:', hoarding_no, data);

      const { data: result, error } = await supabase.functions.invoke('update-banners', {
        body: {
          hoarding_no,
          topic: data.topic,
          heading: data.heading,
          description: data.description,
          images: data.images
        }
      });

      if (error) {
        console.error('[bannerService] Error updating banner:', error);
        return { success: false, error };
      }

      console.log('[bannerService] Successfully updated banner:', hoarding_no);
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[bannerService] Exception updating banner:', err);
      return { success: false, error: err };
    }
  }
};
