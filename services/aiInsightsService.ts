/**
 * AI Insights Service
 * Fetches AI-powered recommendations for merchants
 */

import { supabase } from './supabaseClient';

export interface AIInsight {
  id: string;
  type: 'pricing' | 'timing' | 'action' | 'category' | 'engagement';
  title: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number; // 0-100
  actionText?: string;
  actionRoute?: string;
}

export const aiInsightsService = {
  /**
   * Get AI-powered insights for a merchant
   * Calls the get-ai-insights Edge Function
   */
  async getAIInsights(merchantId: string, locale: string = 'en'): Promise<AIInsight[]> {
    try {
      const { data, error } = await supabase.functions.invoke('get-ai-insights', {
        body: { merchantId, locale },
      });

      if (error) throw new Error('Unable to load insights. Please try again.');

      return data?.insights || [];
    } catch (error) {
      console.error('[aiInsightsService] Error fetching AI insights:', error);
      return [];
    }
  },
};
