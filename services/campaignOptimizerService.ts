/**
 * Campaign Optimizer Service
 * Real-time campaign optimization during creation
 */

import { supabase } from './supabaseClient';

export interface OptimizationSuggestion {
  field: 'discount' | 'launch_date' | 'duration' | 'title' | 'category' | 'overall';
  severity: 'error' | 'warning' | 'success' | 'info';
  message: string;
  suggestion: string;
  impact?: string;
  currentValue?: string | number;
  recommendedValue?: string | number;
}

export interface OptimizationResult {
  score: number; // 0-100 predicted performance score
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  suggestions: OptimizationSuggestion[];
  quickFixes: string[];
  predictedEngagement: 'Very High' | 'High' | 'Medium' | 'Low';
}

export interface CampaignData {
  title?: string;
  discount?: number;
  launch_date?: string;
  end_date?: string;
  category?: string;
  [key: string]: any;
}

export const campaignOptimizerService = {
  /**
   * Get real-time optimization suggestions for campaign data
   */
  async optimize(merchantId: string, campaignData: CampaignData): Promise<OptimizationResult | null> {
    try {
      const { campaign_type, ...restData } = campaignData;
      const { data, error } = await supabase.functions.invoke('optimize-campaign', {
        body: { merchantId, campaignData: restData, campaign_type },
      });

      if (error) {
        console.error('[campaignOptimizerService] Error optimizing campaign:', error);
        return null;
      }

      return data as OptimizationResult;
    } catch (error) {
      console.error('[campaignOptimizerService] Exception:', error);
      return null;
    }
  },
};
