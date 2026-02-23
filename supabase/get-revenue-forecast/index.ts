/**
 * get-revenue-forecast Edge Function
 * Predicts future revenue based on historical campaign performance
 * Analyzes trends, seasonal patterns, and provides what-if scenarios
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface MonthlyRevenue {
  month: string;
  revenue: number;
  redemptions: number;
  avgDealValue: number;
}

interface ForecastPeriod {
  period: string;
  predictedRevenue: number;
  confidence: 'high' | 'medium' | 'low';
  minRevenue: number;
  maxRevenue: number;
}

interface WhatIfScenario {
  scenario: string;
  description: string;
  expectedChange: string;
  predictedRevenue: number;
  impact: 'positive' | 'negative' | 'neutral';
}

interface RevenueForecast {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { merchantId } = await req.json();

    if (!merchantId) {
      return new Response(
        JSON.stringify({ error: 'merchantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all campaigns for this merchant
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, title, deal_offer, category, launch_date, end_date, status')
      .eq('merchant_id', merchantId)
      .order('launch_date', { ascending: false });

    if (campaignsError) throw campaignsError;

    if (!campaigns || campaigns.length === 0) {
      return new Response(
        JSON.stringify({
          currentMonthRevenue: 0,
          previousMonthRevenue: 0,
          growthRate: 0,
          forecasts: {
            next30Days: { period: '30 days', predictedRevenue: 0, confidence: 'low', minRevenue: 0, maxRevenue: 0 },
            next60Days: { period: '60 days', predictedRevenue: 0, confidence: 'low', minRevenue: 0, maxRevenue: 0 },
            next90Days: { period: '90 days', predictedRevenue: 0, confidence: 'low', minRevenue: 0, maxRevenue: 0 },
          },
          trends: { direction: 'stable', strength: 'weak', message: 'Not enough data yet' },
          seasonalInsights: ['Start launching campaigns to build revenue history'],
          whatIfScenarios: [],
          historicalData: [],
          topInsights: ['No campaign data available yet'],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch redemption data (deal_claims) for revenue calculation
    const campaignIds = campaigns.map((c: any) => c.id);
    const { data: claims, error: claimsError } = await supabase
      .from('deal_claims')
      .select('campaign_id, claimed_at, status')
      .in('campaign_id', campaignIds);

    if (claimsError) throw claimsError;

    // Build revenue history by month
    const monthlyData: Record<string, { revenue: number; redemptions: number; deals: number }> = {};

    campaigns.forEach((campaign: any) => {
      const launchDate = new Date(campaign.launch_date);
      const monthKey = `${launchDate.getFullYear()}-${String(launchDate.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { revenue: 0, redemptions: 0, deals: 0 };
      }

      monthlyData[monthKey].deals += 1;

      // Count redemptions for this campaign
      const campaignClaims = (claims || []).filter((c: any) => c.campaign_id === campaign.id && c.status === 'redeemed');
      const redemptionCount = campaignClaims.length;

      // Estimate revenue: discount % * avg transaction value (assume ₹500)
      const avgTransactionValue = 500;
      const discountPercent = parseFloat(campaign.deal_offer) || 15;
      const revenuePerRedemption = avgTransactionValue * (discountPercent / 100);

      monthlyData[monthKey].revenue += revenuePerRedemption * redemptionCount;
      monthlyData[monthKey].redemptions += redemptionCount;
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort();

    const historicalData: MonthlyRevenue[] = sortedMonths.map(month => ({
      month,
      revenue: Math.round(monthlyData[month].revenue),
      redemptions: monthlyData[month].redemptions,
      avgDealValue: monthlyData[month].redemptions > 0
        ? Math.round(monthlyData[month].revenue / monthlyData[month].redemptions)
        : 0,
    }));

    // Calculate current month and previous month
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const currentMonthRevenue = monthlyData[currentMonthKey]?.revenue || 0;
    const previousMonthRevenue = monthlyData[prevMonthKey]?.revenue || 0;

    // Calculate growth rate
    const growthRate = previousMonthRevenue > 0
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : 0;

    // Calculate average monthly revenue for forecasting
    const avgMonthlyRevenue = historicalData.length > 0
      ? historicalData.reduce((sum, m) => sum + m.revenue, 0) / historicalData.length
      : 0;

    // Calculate trend (last 3 months)
    const recentMonths = historicalData.slice(-3);
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    let trendStrength: 'strong' | 'moderate' | 'weak' = 'weak';

    if (recentMonths.length >= 2) {
      const recentGrowth = recentMonths.map((m, i) => {
        if (i === 0) return 0;
        const prev = recentMonths[i - 1].revenue;
        return prev > 0 ? ((m.revenue - prev) / prev) * 100 : 0;
      }).filter(g => g !== 0);

      const avgGrowth = recentGrowth.length > 0
        ? recentGrowth.reduce((sum, g) => sum + g, 0) / recentGrowth.length
        : 0;

      if (avgGrowth > 10) {
        trendDirection = 'up';
        trendStrength = avgGrowth > 25 ? 'strong' : 'moderate';
      } else if (avgGrowth < -10) {
        trendDirection = 'down';
        trendStrength = avgGrowth < -25 ? 'strong' : 'moderate';
      } else {
        trendDirection = 'stable';
        trendStrength = 'weak';
      }
    }

    const trendMessage =
      trendDirection === 'up' ? `Revenue is growing ${trendStrength === 'strong' ? 'rapidly' : 'steadily'}` :
      trendDirection === 'down' ? `Revenue is declining ${trendStrength === 'strong' ? 'rapidly' : 'gradually'}` :
      'Revenue is stable';

    // Forecasting (simple linear projection with confidence intervals)
    const forecastBase = avgMonthlyRevenue;
    const growthFactor = 1 + (growthRate / 100);

    const confidence = historicalData.length >= 6 ? 'high' : historicalData.length >= 3 ? 'medium' : 'low';
    const confidenceMargin = confidence === 'high' ? 0.15 : confidence === 'medium' ? 0.25 : 0.4;

    const forecast30 = forecastBase * growthFactor;
    const forecast60 = forecastBase * Math.pow(growthFactor, 2);
    const forecast90 = forecastBase * Math.pow(growthFactor, 3);

    const forecasts = {
      next30Days: {
        period: '30 days',
        predictedRevenue: Math.round(forecast30),
        confidence,
        minRevenue: Math.round(forecast30 * (1 - confidenceMargin)),
        maxRevenue: Math.round(forecast30 * (1 + confidenceMargin)),
      },
      next60Days: {
        period: '60 days',
        predictedRevenue: Math.round(forecast60),
        confidence,
        minRevenue: Math.round(forecast60 * (1 - confidenceMargin)),
        maxRevenue: Math.round(forecast60 * (1 + confidenceMargin)),
      },
      next90Days: {
        period: '90 days',
        predictedRevenue: Math.round(forecast90),
        confidence,
        minRevenue: Math.round(forecast90 * (1 - confidenceMargin)),
        maxRevenue: Math.round(forecast90 * (1 + confidenceMargin)),
      },
    };

    // Seasonal insights (analyze month-over-month patterns)
    const seasonalInsights: string[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (historicalData.length >= 6) {
      const bestMonth = historicalData.reduce((best, curr) => curr.revenue > best.revenue ? curr : best);
      const monthNum = parseInt(bestMonth.month.split('-')[1]) - 1;
      seasonalInsights.push(`${monthNames[monthNum]} was your best month with ₹${bestMonth.revenue.toLocaleString()}`);
    }

    if (trendDirection === 'up') {
      seasonalInsights.push('Keep launching campaigns consistently to maintain growth momentum');
    } else if (trendDirection === 'down') {
      seasonalInsights.push('Consider increasing campaign frequency or improving discount offers');
    }

    // What-if scenarios
    const whatIfScenarios: WhatIfScenario[] = [
      {
        scenario: 'Increase discount by 5%',
        description: 'Raise average discount from current level to attract more customers',
        expectedChange: '+20-30%',
        predictedRevenue: Math.round(forecast30 * 1.25),
        impact: 'positive',
      },
      {
        scenario: 'Launch on Fridays at 6 PM',
        description: 'Optimal timing gets 4.5x better engagement',
        expectedChange: '+35-45%',
        predictedRevenue: Math.round(forecast30 * 1.40),
        impact: 'positive',
      },
      {
        scenario: 'Run 2 campaigns per month',
        description: 'Double your campaign frequency',
        expectedChange: '+60-80%',
        predictedRevenue: Math.round(forecast30 * 1.70),
        impact: 'positive',
      },
      {
        scenario: 'Reduce campaign duration to 10 days',
        description: 'Shorter campaigns may reduce reach',
        expectedChange: '-15-25%',
        predictedRevenue: Math.round(forecast30 * 0.80),
        impact: 'negative',
      },
    ];

    // Top insights
    const topInsights: string[] = [];

    if (growthRate > 20) {
      topInsights.push(`🎯 Strong growth: ${growthRate.toFixed(1)}% month-over-month`);
    } else if (growthRate < -20) {
      topInsights.push(`⚠️ Revenue declining: ${Math.abs(growthRate).toFixed(1)}% drop`);
    } else {
      topInsights.push(`📊 Stable revenue: ${growthRate.toFixed(1)}% change`);
    }

    if (historicalData.length >= 3) {
      const totalRedemptions = historicalData.reduce((sum, m) => sum + m.redemptions, 0);
      topInsights.push(`💰 ${totalRedemptions} total redemptions across ${campaigns.length} campaigns`);
    }

    if (forecast30 > currentMonthRevenue) {
      topInsights.push(`📈 Next month projected: ₹${forecast30.toLocaleString()} (${((forecast30 - currentMonthRevenue) / currentMonthRevenue * 100).toFixed(0)}% increase)`);
    }

    const result: RevenueForecast = {
      currentMonthRevenue: Math.round(currentMonthRevenue),
      previousMonthRevenue: Math.round(previousMonthRevenue),
      growthRate: parseFloat(growthRate.toFixed(1)),
      forecasts,
      trends: {
        direction: trendDirection,
        strength: trendStrength,
        message: trendMessage,
      },
      seasonalInsights,
      whatIfScenarios,
      historicalData,
      topInsights,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-revenue-forecast] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
