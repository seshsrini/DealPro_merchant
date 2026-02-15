import { supabase } from './supabaseClient';

export interface Hoarding {
  id: string;
  hoarding_no: number;
  topic: string;
  heading: string;
  description: string;
  images: string[];
  created_at: string;
  modified_at: string;
}

/**
 * Hoarding Service
 * Handles fetching billboard/hoarding data for marketing displays
 */
export const hoardingService = {
  /**
   * Get all hoardings, ordered by hoarding_no
   */
  async getAllHoardings(): Promise<{ data: Hoarding[] | null; error: any }> {
    try {
      console.log('[hoardingService] Fetching all hoardings');

      const { data, error } = await supabase.functions.invoke('get-hoardings', {
        body: {}
      });

      if (error) {
        console.error('[hoardingService] Error fetching hoardings:', error);
        return { data: null, error };
      }

      console.log('[hoardingService] Successfully fetched hoardings:', data?.hoardings?.length || 0);
      return { data: data?.hoardings || [], error: null };
    } catch (err: any) {
      console.error('[hoardingService] Exception fetching hoardings:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Get a specific hoarding by hoarding number (1, 2, or 3)
   */
  async getHoardingByNumber(hoarding_no: number): Promise<{ data: Hoarding | null; error: any }> {
    try {
      console.log('[hoardingService] Fetching hoarding number:', hoarding_no);

      const { data, error } = await supabase.functions.invoke('get-hoardings', {
        body: { hoarding_no }
      });

      if (error) {
        console.error('[hoardingService] Error fetching hoarding:', error);
        return { data: null, error };
      }

      console.log('[hoardingService] Successfully fetched hoarding:', hoarding_no);
      return { data: data?.hoarding || null, error: null };
    } catch (err: any) {
      console.error('[hoardingService] Exception fetching hoarding:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Get hoardings in sequence for carousel/slideshow
   * Returns hoardings ordered by hoarding_no (1, 2, 3)
   */
  async getHoardingsForCarousel(): Promise<{ data: Hoarding[] | null; error: any }> {
    return this.getAllHoardings();
  }
};
