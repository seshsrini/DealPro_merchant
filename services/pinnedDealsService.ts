/**
 * Pinned Deals Service
 * Handles pinning/unpinning deals for future reference
 * Uses Supabase Edge Function to bypass RLS issues
 */

import { supabase } from './supabaseClient';

interface PinnedDeal {
  id: string;
  user_id: string;
  campaign_id: string;
  merchant_id: string;
  created_at: string;
}

interface PinnedDealWithDetails extends PinnedDeal {
  campaigns?: {
    deal_heading: string;
    offer_value: string;
    shop_name: string;
    city: string;
    image_url: string;
    category: string;
    status: string;
  };
}

class PinnedDealsService {
  /**
   * Pin a deal for the current user
   */
  async pinDeal(
    userId: string,
    campaignId: string,
    merchantId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-pinned-deals', {
        body: {
          action: 'pin',
          userId,
          campaignId,
          merchantId
        }
      });

      if (error) {
        console.error('[PinnedDeals] Edge Function error:', error);
        return { success: false, error: error.message };
      }

      if (!data.success) {
        console.error('[PinnedDeals] Error pinning deal:', data.error);
        return { success: false, error: data.error };
      }

      console.log('[PinnedDeals] Deal pinned successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[PinnedDeals] Exception pinning deal:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unpin a deal for the current user
   */
  async unpinDeal(
    userId: string,
    campaignId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-pinned-deals', {
        body: {
          action: 'unpin',
          userId,
          campaignId
        }
      });

      if (error) {
        console.error('[PinnedDeals] Edge Function error:', error);
        return { success: false, error: error.message };
      }

      if (!data.success) {
        console.error('[PinnedDeals] Error unpinning deal:', data.error);
        return { success: false, error: data.error };
      }

      console.log('[PinnedDeals] Deal unpinned successfully');
      return { success: true };
    } catch (error: any) {
      console.error('[PinnedDeals] Exception unpinning deal:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Toggle pin status (pin if not pinned, unpin if pinned)
   */
  async togglePin(
    userId: string,
    campaignId: string,
    merchantId: string
  ): Promise<{ success: boolean; isPinned: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-pinned-deals', {
        body: {
          action: 'toggle',
          userId,
          campaignId,
          merchantId
        }
      });

      if (error) {
        console.error('[PinnedDeals] Edge Function error:', error);
        return { success: false, isPinned: false, error: error.message };
      }

      if (!data.success) {
        console.error('[PinnedDeals] Error toggling pin:', data.error);
        return { success: false, isPinned: false, error: data.error };
      }

      console.log(`[PinnedDeals] Deal ${data.isPinned ? 'pinned' : 'unpinned'} successfully`);
      return { success: true, isPinned: data.isPinned };
    } catch (error: any) {
      console.error('[PinnedDeals] Exception toggling pin:', error);
      return { success: false, isPinned: false, error: error.message };
    }
  }

  /**
   * Check if a deal is pinned by the current user
   */
  async isPinned(userId: string, campaignId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-pinned-deals', {
        body: {
          action: 'check',
          userId,
          campaignId
        }
      });

      if (error) {
        console.error('[PinnedDeals] Edge Function error:', error);
        return false;
      }

      if (!data.success) {
        console.error('[PinnedDeals] Error checking pin status:', data.error);
        return false;
      }

      return data.isPinned || false;
    } catch (error) {
      console.error('[PinnedDeals] Exception checking pin status:', error);
      return false;
    }
  }

  /**
   * Get all pinned deals for a user
   */
  async getUserPinnedDeals(userId: string): Promise<PinnedDealWithDetails[]> {
    try {
      console.log('[PinnedDeals] Fetching pinned deals for user:', userId);
      const { data, error } = await supabase.functions.invoke('manage-pinned-deals', {
        body: {
          action: 'list',
          userId
        }
      });

      console.log('[PinnedDeals] Edge Function response:', { data, error });

      if (error) {
        console.error('[PinnedDeals] Edge Function error:', error);
        console.error('[PinnedDeals] Error details:', JSON.stringify(error, null, 2));
        return [];
      }

      if (!data) {
        console.error('[PinnedDeals] No data returned from Edge Function');
        return [];
      }

      if (!data.success) {
        console.error('[PinnedDeals] Error fetching pinned deals:', data.error);
        return [];
      }

      console.log('[PinnedDeals] Successfully fetched pins:', data.pins?.length || 0, 'deals');
      return data.pins || [];
    } catch (error) {
      console.error('[PinnedDeals] Exception fetching pinned deals:', error);
      return [];
    }
  }

  /**
   * Get pinned deals count for a user
   */
  async getPinnedDealsCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase.functions.invoke('manage-pinned-deals', {
        body: {
          action: 'list',
          userId
        }
      });

      if (error) {
        console.error('[PinnedDeals] Edge Function error:', error);
        return 0;
      }

      if (!data.success) {
        console.error('[PinnedDeals] Error getting count:', data.error);
        return 0;
      }

      return data.count || 0;
    } catch (error) {
      console.error('[PinnedDeals] Exception getting count:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const pinnedDealsService = new PinnedDealsService();

/**
 * USAGE EXAMPLES:
 *
 * // Pin a deal
 * const result = await pinnedDealsService.pinDeal(userId, campaignId, merchantId);
 * if (result.success) {
 *   console.log('Deal pinned!');
 * }
 *
 * // Unpin a deal
 * await pinnedDealsService.unpinDeal(userId, campaignId);
 *
 * // Toggle pin (recommended for UI)
 * const { success, isPinned } = await pinnedDealsService.togglePin(userId, campaignId, merchantId);
 * if (success) {
 *   console.log(isPinned ? 'Pinned!' : 'Unpinned!');
 * }
 *
 * // Check if deal is pinned
 * const isPinned = await pinnedDealsService.isPinned(userId, campaignId);
 *
 * // Get all pinned deals for user
 * const pinnedDeals = await pinnedDealsService.getUserPinnedDeals(userId);
 *
 * // Get count
 * const count = await pinnedDealsService.getPinnedDealsCount(userId);
 */
