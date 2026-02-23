/**
 * Revenue Forecast Service
 * Fetches revenue predictions and forecasts
 */

import { supabase } from './supabaseClient';

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  redemptions: number;
  avgDealValue: number;
}

export interface ForecastPeriod {
  period: string;
  predictedRevenue: number;
  confidence: 'high' | 'medium' | 'low';
  minRevenue: number;
  maxRevenue: number;
}

export interface WhatIfScenario {
  scenario: string;
  description: string;
  expectedChange: string;
  predictedRevenue: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface RevenueForecast {
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  growthRate: number;
  forecasts: {
    next30Days: ForecastPeriod;
    next60Days: ForecastPeriod;
    next90Days: ForecastPeriod;
  };
  trends: {
    direction: 'up' | 'down' | 'stable';
    strength: 'strong' | 'moderate' | 'weak';
    message: string;
  };
  seasonalInsights: string[];
  whatIfScenarios: WhatIfScenario[];
  historicalData: MonthlyRevenue[];
  topInsights: string[];
}

export const revenueForecastService = {
  /**
   * Get revenue forecast and predictions for a merchant
   */
  async getForecast(merchantId: string): Promise<RevenueForecast | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-revenue-forecast', {
        body: { merchantId },
      });

      if (error) {
        console.error('[revenueForecastService] Error fetching forecast:', error);
        return null;
      }

      return data as RevenueForecast;
    } catch (error) {
      console.error('[revenueForecastService] Exception:', error);
      return null;
    }
  },
};
