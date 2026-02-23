/**
 * Performance Score Service
 * Fetches merchant performance score and breakdown
 */

import { supabase } from './supabaseClient';

export interface ScoreFactor {
  name: string;
  score: number;
  maxScore: number;
  status: 'excellent' | 'good' | 'needs-improvement';
  message: string;
  tips?: string[];
}

export interface PerformanceScore {
  totalScore: number;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
  factors: ScoreFactor[];
  quickWins: Array<{ tip: string; points: number }>;
}

export const performanceScoreService = {
  /**
   * Get comprehensive performance score for a merchant
   */
  async getScore(merchantId: string): Promise<PerformanceScore | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-performance-score', {
        body: { merchantId },
      });

      if (error) {
        console.error('[performanceScoreService] Error fetching score:', error);
        return null;
      }

      return data as PerformanceScore;
    } catch (error) {
      console.error('[performanceScoreService] Exception:', error);
      return null;
    }
  },
};
