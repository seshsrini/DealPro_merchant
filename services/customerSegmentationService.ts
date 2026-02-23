/**
 * Customer Segmentation Service
 * Analyzes and segments merchant's customer base
 */

import { supabase } from './supabaseClient';

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  count: number;
  percentage: number;
  avgRedemptions: number;
  preferredDiscount: string;
  topCategory: string;
  peakTime: string;
  recommendation: string;
  value: 'high' | 'medium' | 'low';
}

export interface SegmentationInsights {
  totalCustomers: number;
  segments: CustomerSegment[];
  engagementStatus: {
    active: number;
    occasional: number;
    dormant: number;
  };
  categoryPreferences: Record<string, Record<string, number>>;
  topInsights: string[];
  recommendations: string[];
}

export const customerSegmentationService = {
  /**
   * Get customer segmentation insights for a merchant
   */
  async getSegments(merchantId: string): Promise<SegmentationInsights | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-customer-segments', {
        body: { merchantId },
      });

      if (error) {
        console.error('[customerSegmentationService] Error fetching segments:', error);
        return null;
      }

      return data as SegmentationInsights;
    } catch (error) {
      console.error('[customerSegmentationService] Exception:', error);
      return null;
    }
  },
};
