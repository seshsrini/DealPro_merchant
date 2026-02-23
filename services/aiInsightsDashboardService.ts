/**
 * AI Insights Dashboard Service
 * Fetches comprehensive AI insights for dedicated dashboard
 */

import { supabase } from './supabaseClient';

export interface ProductDescriptionSuggestion {
  productId: string;
  productName: string;
  currentDescription: string | null;
  suggestedDescription: string;
  improvements: string[];
  impactScore: number;
}

export interface PricingStrategy {
  category: string;
  productCount: number;
  recommendedDiscountMin: number;
  recommendedDiscountMax: number;
  optimalPrice: string;
  reasoning: string;
  expectedLift: string;
}

export interface DemandForecast {
  category: string;
  trend: 'rising' | 'stable' | 'declining';
  nextWeekPrediction: string;
  confidence: number;
  recommendation: string;
}

export interface CategoryRecommendation {
  suggestedCategory: string;
  reason: string;
  potentialReach: string;
  difficulty: 'easy' | 'medium' | 'hard';
  priority: number;
}

export interface DashboardInsights {
  productOptimizations: ProductDescriptionSuggestion[];
  pricingStrategies: PricingStrategy[];
  demandForecasts: DemandForecast[];
  categoryRecommendations: CategoryRecommendation[];
  performancePredictions: {
    nextWeekViews: number;
    nextWeekLikes: number;
    growthRate: number;
    confidence: number;
  };
  competitiveInsights: {
    yourPosition: string;
    suggestion: string;
    actionItems: string[];
  };
}

export const aiInsightsDashboardService = {
  /**
   * Get comprehensive AI insights for dashboard
   * Calls the get-ai-insights-dashboard Edge Function
   */
  async getDashboardInsights(merchantId: string): Promise<DashboardInsights | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-ai-insights-dashboard', {
        body: { merchantId },
      });

      if (error) throw error;

      return data?.insights || null;
    } catch (error) {
      console.error('[aiInsightsDashboardService] Error fetching dashboard insights:', error);
      return null;
    }
  },
};
