/**
 * optimize-campaign Edge Function
 * Real-time campaign optimization suggestions during creation
 * Analyzes partial campaign data and provides instant feedback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface OptimizationSuggestion {
  field: 'discount' | 'launch_date' | 'duration' | 'title' | 'category' | 'overall';
  severity: 'error' | 'warning' | 'success' | 'info';
  message: string;
  suggestion: string;
  impact?: string;
  currentValue?: string | number;
  recommendedValue?: string | number;
}

interface OptimizationResult {
  score: number; // 0-100 predicted performance score
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  suggestions: OptimizationSuggestion[];
  quickFixes: string[];
  predictedEngagement: 'Very High' | 'High' | 'Medium' | 'Low';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { merchantId, campaignData } = await req.json();

    if (!merchantId) {
      return new Response(
        JSON.stringify({ error: 'merchantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const suggestions: OptimizationSuggestion[] = [];
    const quickFixes: string[] = [];
    let score = 100; // Start at perfect, deduct points for issues

    // ========== DISCOUNT OPTIMIZATION ==========
    if (campaignData.discount !== undefined && campaignData.discount !== null) {
      const discount = parseFloat(campaignData.discount);

      if (discount < 5) {
        score -= 30;
        suggestions.push({
          field: 'discount',
          severity: 'error',
          message: 'Discount too low',
          suggestion: 'Discounts below 5% rarely attract customers. Try 15-25% for optimal engagement.',
          impact: 'Low engagement expected',
          currentValue: discount,
          recommendedValue: '15-25%',
        });
        quickFixes.push('Increase discount to 15-25%');
      } else if (discount < 10) {
        score -= 20;
        suggestions.push({
          field: 'discount',
          severity: 'warning',
          message: 'Discount below optimal range',
          suggestion: 'Consider 15-25% discount for 3.2x better engagement while maintaining healthy margins.',
          impact: 'Moderate engagement',
          currentValue: discount,
          recommendedValue: '15-25%',
        });
        quickFixes.push('Increase discount to 15-25%');
      } else if (discount >= 10 && discount <= 30) {
        suggestions.push({
          field: 'discount',
          severity: 'success',
          message: 'Optimal discount range',
          suggestion: `${discount}% is in the sweet spot for maximum engagement and profitability.`,
          impact: 'High engagement expected',
          currentValue: discount,
        });
      } else if (discount > 30 && discount <= 50) {
        score -= 15;
        suggestions.push({
          field: 'discount',
          severity: 'warning',
          message: 'Discount higher than necessary',
          suggestion: 'While attractive, discounts above 30% may reduce margins without significant engagement gains. Consider 20-25%.',
          impact: 'High engagement but lower margins',
          currentValue: discount,
          recommendedValue: '20-25%',
        });
      } else if (discount > 50) {
        score -= 25;
        suggestions.push({
          field: 'discount',
          severity: 'error',
          message: 'Discount too high',
          suggestion: 'Discounts above 50% can hurt brand perception and profitability. Max recommended: 30%.',
          impact: 'Margin concerns',
          currentValue: discount,
          recommendedValue: '15-30%',
        });
        quickFixes.push('Reduce discount to 15-30%');
      }
    }

    // ========== LAUNCH DATE & TIME OPTIMIZATION ==========
    if (campaignData.launch_date) {
      const launchDate = new Date(campaignData.launch_date);
      const now = new Date();
      const dayOfWeek = launchDate.getDay(); // 0 = Sunday, 5 = Friday
      const hour = launchDate.getHours();

      // Check if at least 2 days ahead
      const daysAhead = Math.ceil((launchDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysAhead < 2) {
        score -= 25;
        suggestions.push({
          field: 'launch_date',
          severity: 'error',
          message: 'Launch date too soon',
          suggestion: 'Campaign must start at least 2 days from now to give better consumer value and time for promotion.',
          impact: 'May be rejected',
          currentValue: `${daysAhead} day${daysAhead !== 1 ? 's' : ''} ahead`,
          recommendedValue: 'At least 2 days ahead',
        });
        quickFixes.push('Set launch date to at least 2 days ahead');
      }

      // Check if Friday
      if (dayOfWeek !== 5) {
        score -= 20;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        suggestions.push({
          field: 'launch_date',
          severity: 'warning',
          message: 'Not launching on Friday',
          suggestion: `You're launching on ${dayNames[dayOfWeek]}. Friday launches get 4.5x better engagement. Consider moving to next Friday.`,
          impact: 'Lower visibility',
          currentValue: dayNames[dayOfWeek],
          recommendedValue: 'Friday',
        });
        quickFixes.push('Change launch to Friday evening');
      } else {
        // Check if evening time (6-8 PM)
        if (hour < 18 || hour > 20) {
          score -= 10;
          suggestions.push({
            field: 'launch_date',
            severity: 'info',
            message: 'Consider evening launch',
            suggestion: 'Launching between 6-8 PM on Friday maximizes weekend visibility and engagement.',
            impact: 'Can improve by 15-20%',
            currentValue: `${hour}:00`,
            recommendedValue: '18:00-20:00 (6-8 PM)',
          });
          quickFixes.push('Set launch time to 6-8 PM');
        } else {
          suggestions.push({
            field: 'launch_date',
            severity: 'success',
            message: 'Perfect launch timing',
            suggestion: 'Friday evening 6-8 PM is the optimal launch window for maximum engagement!',
            impact: 'Maximum visibility expected',
          });
        }
      }
    }

    // ========== DURATION OPTIMIZATION ==========
    if (campaignData.end_date && campaignData.launch_date) {
      const startDate = new Date(campaignData.launch_date);
      const endDate = new Date(campaignData.end_date);
      const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (durationDays !== 15) {
        score -= 20;
        suggestions.push({
          field: 'duration',
          severity: 'error',
          message: 'Duration must be 15 days',
          suggestion: 'Campaigns must run for exactly 15 days from start date for maximum consumer benefit and platform policy.',
          impact: 'May be rejected',
          currentValue: `${durationDays} days`,
          recommendedValue: '15 days',
        });
        quickFixes.push('Set duration to 15 days');
      } else {
        suggestions.push({
          field: 'duration',
          severity: 'success',
          message: 'Optimal campaign duration',
          suggestion: '15-day duration provides the best balance of visibility and urgency.',
          impact: 'Maximum deal exposure',
        });
      }
    }

    // ========== TITLE OPTIMIZATION ==========
    if (campaignData.title) {
      const titleLength = campaignData.title.trim().length;

      if (titleLength < 10) {
        score -= 20;
        suggestions.push({
          field: 'title',
          severity: 'warning',
          message: 'Title too short',
          suggestion: 'Short titles miss opportunities to engage. Aim for 30-50 characters with specific details (e.g., "50% Off Premium Wireless Headphones - Limited Time").',
          impact: 'Lower click rates',
          currentValue: `${titleLength} characters`,
          recommendedValue: '30-50 characters',
        });
        quickFixes.push('Expand title to 30-50 characters');
      } else if (titleLength >= 10 && titleLength < 30) {
        score -= 10;
        suggestions.push({
          field: 'title',
          severity: 'info',
          message: 'Title could be more descriptive',
          suggestion: 'Titles with 30-50 characters get 2.1x more clicks. Add specific product details or value proposition.',
          impact: 'Good but can improve',
          currentValue: `${titleLength} characters`,
          recommendedValue: '30-50 characters',
        });
      } else if (titleLength >= 30 && titleLength <= 60) {
        suggestions.push({
          field: 'title',
          severity: 'success',
          message: 'Excellent title length',
          suggestion: 'Title length is optimal for engagement and search visibility.',
          impact: 'High click-through expected',
        });
      } else if (titleLength > 60) {
        score -= 15;
        suggestions.push({
          field: 'title',
          severity: 'warning',
          message: 'Title too long',
          suggestion: 'Long titles may be truncated on mobile. Keep it concise (30-50 characters) and impactful.',
          impact: 'May be cut off on mobile',
          currentValue: `${titleLength} characters`,
          recommendedValue: '30-50 characters',
        });
        quickFixes.push('Shorten title to 30-50 characters');
      }

      // Check for ALL CAPS
      if (campaignData.title === campaignData.title.toUpperCase() && titleLength > 5) {
        score -= 10;
        suggestions.push({
          field: 'title',
          severity: 'warning',
          message: 'Avoid all caps',
          suggestion: 'ALL CAPS titles appear spammy. Use title case for professional appearance (e.g., "Great Deal on Sneakers").',
          impact: 'Lower trust',
        });
        quickFixes.push('Change title to title case');
      }
    }

    // ========== CATEGORY OPTIMIZATION ==========
    if (campaignData.category) {
      // Fetch merchant's products to see if category matches their inventory
      const { data: products } = await supabase
        .from('products')
        .select('category')
        .eq('merchant_id', merchantId)
        .eq('is_active', true);

      if (products && products.length > 0) {
        const categoryMap: Record<string, number> = {};
        products.forEach((p: any) => {
          const cat = p.category || 'General';
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        });

        const topCategory = Object.entries(categoryMap).sort(([, a], [, b]) => b - a)[0];

        if (campaignData.category === topCategory[0]) {
          suggestions.push({
            field: 'category',
            severity: 'success',
            message: 'Category matches your strengths',
            suggestion: `This matches your top category (${topCategory[0]}) where you have ${topCategory[1]} products. Great choice!`,
            impact: 'Aligned with inventory',
          });
        } else {
          score -= 5;
          suggestions.push({
            field: 'category',
            severity: 'info',
            message: 'Consider your top category',
            suggestion: `You have the most products in ${topCategory[0]} (${topCategory[1]} products). Deals in your strongest category often perform better.`,
            impact: 'Minor optimization opportunity',
            recommendedValue: topCategory[0],
          });
        }
      }
    }

    // ========== OVERALL SCORE & GRADE ==========
    score = Math.max(0, Math.min(100, score)); // Clamp between 0-100

    let grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    if (score >= 85) grade = 'Excellent';
    else if (score >= 70) grade = 'Good';
    else if (score >= 50) grade = 'Fair';
    else grade = 'Poor';

    let predictedEngagement: 'Very High' | 'High' | 'Medium' | 'Low';
    if (score >= 85) predictedEngagement = 'Very High';
    else if (score >= 70) predictedEngagement = 'High';
    else if (score >= 50) predictedEngagement = 'Medium';
    else predictedEngagement = 'Low';

    // Add overall summary
    if (suggestions.filter(s => s.severity === 'error').length > 0) {
      suggestions.push({
        field: 'overall',
        severity: 'error',
        message: 'Campaign has critical issues',
        suggestion: 'Fix the errors above before submitting. These issues may cause rejection or poor performance.',
        impact: 'High risk of rejection',
      });
    } else if (score >= 85) {
      suggestions.push({
        field: 'overall',
        severity: 'success',
        message: 'Excellent campaign setup!',
        suggestion: 'Your campaign is optimized for maximum engagement. Ready to launch!',
        impact: 'Very high success probability',
      });
    } else if (score >= 70) {
      suggestions.push({
        field: 'overall',
        severity: 'success',
        message: 'Good campaign setup',
        suggestion: 'Your campaign looks solid. Consider the suggestions above for even better results.',
        impact: 'High success probability',
      });
    }

    const result: OptimizationResult = {
      score,
      grade,
      suggestions,
      quickFixes: quickFixes.slice(0, 3), // Top 3 quick fixes
      predictedEngagement,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[optimize-campaign] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
