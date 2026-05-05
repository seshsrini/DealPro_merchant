/**
 * get-performance-score Edge Function
 * Calculates comprehensive merchant performance score (0-100)
 * Based on: Product Portfolio, Campaign Activity, Launch Timing, Pricing, Engagement, Category Coverage
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface ScoreFactor {
  name: string;
  score: number;
  maxScore: number;
  status: 'excellent' | 'good' | 'needs-improvement';
  message: string;
  tips?: string[];
}

interface PerformanceScore {
  totalScore: number;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
  factors: ScoreFactor[];
  quickWins: Array<{ tip: string; points: number }>;
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
    console.log('[GetPerformanceScore] Calculating score for merchant:', merchantId);

    if (!merchantId) {
      return new Response(
        JSON.stringify({ error: 'merchantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch merchant's products
    const { data: products } = await supabase
      .from('products')
      .select('id, name, category, created_at')
      .eq('merchant_id', merchantId)
      .eq('is_active', true);

    // Fetch merchant's campaigns
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('campaign_id, status, created_at, end_date, offer_value, category')
      .eq('merchant_id', merchantId);

    const productCount = products?.length || 0;
    const campaignCount = campaigns?.length || 0;
    const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0;
    const approvedCampaigns = campaigns?.filter(c => c.status === 'active' || c.status === 'expired').length || 0;

    const factors: ScoreFactor[] = [];
    const quickWins: Array<{ tip: string; points: number }> = [];

    // ============ FACTOR 1: Product Portfolio (0-20 points) ============
    let productScore = 0;
    let productStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let productMessage = '';

    if (productCount === 0) {
      productMessage = 'No products yet - add products to get started!';
      quickWins.push({ tip: 'Add your first 5 products', points: 10 });
    } else if (productCount < 5) {
      productScore = 5;
      productStatus = 'needs-improvement';
      productMessage = `${productCount} products - add more for better reach`;
      quickWins.push({ tip: `Add ${10 - productCount} more products to reach 10`, points: 10 });
    } else if (productCount < 10) {
      productScore = 10;
      productStatus = 'good';
      productMessage = `${productCount} products - good start!`;
      quickWins.push({ tip: `Add ${10 - productCount} more products`, points: 5 });
    } else if (productCount < 20) {
      productScore = 15;
      productStatus = 'good';
      productMessage = `${productCount} products - solid portfolio`;
    } else {
      productScore = 20;
      productStatus = 'excellent';
      productMessage = `${productCount} products - excellent portfolio!`;
    }

    // Category diversity bonus
    const categories = new Set(products?.map(p => p.category));
    const categoryCount = categories.size;

    factors.push({
      name: 'Product Portfolio',
      score: productScore,
      maxScore: 20,
      status: productStatus,
      message: productMessage,
      tips: categoryCount < 3 ? [`Expand to ${3 - categoryCount} more categories for broader appeal`] : undefined,
    });

    // ============ FACTOR 2: Campaign Activity (0-20 points) ============
    let campaignScore = 0;
    let campaignStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let campaignMessage = '';

    if (campaignCount === 0) {
      campaignMessage = 'No campaigns yet - create your first deal!';
      quickWins.push({ tip: 'Launch your first campaign', points: 10 });
    } else {
      // Calculate average deals per month
      const oldestCampaign = campaigns?.reduce((oldest, c) => {
        const date = new Date(c.created_at);
        return date < oldest ? date : oldest;
      }, new Date());

      const monthsSinceFirst = Math.max(1, Math.ceil(
        (Date.now() - oldestCampaign.getTime()) / (1000 * 60 * 60 * 24 * 30)
      ));

      const dealsPerMonth = campaignCount / monthsSinceFirst;

      if (dealsPerMonth < 1) {
        campaignScore = 8;
        campaignStatus = 'needs-improvement';
        campaignMessage = `${campaignCount} total deals - increase frequency`;
        quickWins.push({ tip: 'Create 2-3 deals per month for optimal results', points: 8 });
      } else if (dealsPerMonth < 2) {
        campaignScore = 12;
        campaignStatus = 'good';
        campaignMessage = `~${dealsPerMonth.toFixed(1)} deals/month - good pace`;
        quickWins.push({ tip: 'Aim for 2-3 deals per month', points: 5 });
      } else if (dealsPerMonth <= 3) {
        campaignScore = 18;
        campaignStatus = 'excellent';
        campaignMessage = `~${dealsPerMonth.toFixed(1)} deals/month - excellent frequency!`;
      } else {
        campaignScore = 20;
        campaignStatus = 'excellent';
        campaignMessage = `${dealsPerMonth.toFixed(1)} deals/month - very active!`;
      }

      // Active campaigns bonus
      if (activeCampaigns > 0) {
        campaignScore = Math.min(20, campaignScore + 2);
      } else if (campaignCount > 0) {
        quickWins.push({ tip: 'Launch a new active campaign', points: 5 });
      }
    }

    factors.push({
      name: 'Campaign Activity',
      score: campaignScore,
      maxScore: 20,
      status: campaignStatus,
      message: campaignMessage,
      tips: activeCampaigns === 0 && campaignCount > 0 ? ['No active campaigns - launch a new deal'] : undefined,
    });

    // ============ FACTOR 3: Launch Timing (0-15 points) ============
    let timingScore = 0;
    let timingStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let timingMessage = '';

    if (campaignCount === 0) {
      timingMessage = 'No campaigns to analyze';
    } else {
      // Check how many campaigns launched on Friday
      const fridayLaunches = campaigns?.filter(c => {
        const launchDate = new Date(c.created_at);
        return launchDate.getDay() === 5; // Friday
      }).length || 0;

      const fridayPercent = (fridayLaunches / campaignCount) * 100;

      if (fridayPercent === 0) {
        timingScore = 5;
        timingStatus = 'needs-improvement';
        timingMessage = 'No Friday launches - try optimal timing';
        quickWins.push({ tip: 'Launch next campaign on Friday evening (6-8 PM)', points: 8 });
      } else if (fridayPercent < 30) {
        timingScore = 8;
        timingStatus = 'needs-improvement';
        timingMessage = `${fridayPercent.toFixed(0)}% Friday launches - improve timing`;
        quickWins.push({ tip: 'Launch more campaigns on Friday evenings', points: 5 });
      } else if (fridayPercent < 60) {
        timingScore = 11;
        timingStatus = 'good';
        timingMessage = `${fridayPercent.toFixed(0)}% Friday launches - good timing`;
      } else {
        timingScore = 15;
        timingStatus = 'excellent';
        timingMessage = `${fridayPercent.toFixed(0)}% Friday launches - excellent timing!`;
      }
    }

    factors.push({
      name: 'Launch Timing',
      score: timingScore,
      maxScore: 15,
      status: timingStatus,
      message: timingMessage,
      tips: timingScore < 10 ? ['Launch deals on Friday evenings (6-8 PM) for 4.5x better engagement'] : undefined,
    });

    // ============ FACTOR 4: Pricing Strategy (0-15 points) ============
    let pricingScore = 0;
    let pricingStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let pricingMessage = '';

    if (campaignCount === 0) {
      pricingMessage = 'No campaigns to analyze';
    } else {
      // Analyze discount ranges
      const discounts = campaigns?.map(c => c.offer_value || 0) || [];
      const avgDiscount = discounts.reduce((a, b) => a + b, 0) / discounts.length;

      const optimalDiscounts = discounts.filter(d => d >= 10 && d <= 30).length;
      const optimalPercent = (optimalDiscounts / campaignCount) * 100;

      if (optimalPercent === 0) {
        pricingScore = 5;
        pricingStatus = 'needs-improvement';
        pricingMessage = 'Discounts outside optimal range (10-30%)';
        quickWins.push({ tip: 'Use 10-30% discounts for best engagement', points: 7 });
      } else if (optimalPercent < 50) {
        pricingScore = 8;
        pricingStatus = 'needs-improvement';
        pricingMessage = `${optimalPercent.toFixed(0)}% campaigns use optimal pricing`;
      } else if (optimalPercent < 80) {
        pricingScore = 11;
        pricingStatus = 'good';
        pricingMessage = `${optimalPercent.toFixed(0)}% campaigns use optimal pricing`;
      } else {
        pricingScore = 15;
        pricingStatus = 'excellent';
        pricingMessage = `${optimalPercent.toFixed(0)}% campaigns use optimal pricing!`;
      }
    }

    factors.push({
      name: 'Pricing Strategy',
      score: pricingScore,
      maxScore: 15,
      status: pricingStatus,
      message: pricingMessage,
      tips: pricingScore < 10 ? ['Offer 15-25% discounts for optimal balance of engagement and margin'] : undefined,
    });

    // ============ FACTOR 5: Engagement (0-15 points) ============
    let engagementScore = 0;
    let engagementStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let engagementMessage = '';

    if (campaignCount === 0) {
      engagementMessage = 'No campaigns to analyze';
    } else {
      // Approval rate
      const approvalRate = (approvedCampaigns / campaignCount) * 100;

      if (approvalRate < 50) {
        engagementScore = 5;
        engagementStatus = 'needs-improvement';
        engagementMessage = `${approvalRate.toFixed(0)}% approval rate - check quality`;
      } else if (approvalRate < 75) {
        engagementScore = 9;
        engagementStatus = 'good';
        engagementMessage = `${approvalRate.toFixed(0)}% approval rate - good`;
      } else if (approvalRate < 90) {
        engagementScore = 12;
        engagementStatus = 'good';
        engagementMessage = `${approvalRate.toFixed(0)}% approval rate - excellent`;
      } else {
        engagementScore = 15;
        engagementStatus = 'excellent';
        engagementMessage = `${approvalRate.toFixed(0)}% approval rate - outstanding!`;
      }
    }

    factors.push({
      name: 'Engagement',
      score: engagementScore,
      maxScore: 15,
      status: engagementStatus,
      message: engagementMessage,
      tips: engagementScore < 10 ? ['Review admin feedback to improve approval rate'] : undefined,
    });

    // ============ FACTOR 6: Category Coverage (0-15 points) ============
    let coverageScore = 0;
    let coverageStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let coverageMessage = '';

    if (categoryCount === 0) {
      coverageMessage = 'No products yet';
    } else if (categoryCount === 1) {
      coverageScore = 5;
      coverageStatus = 'needs-improvement';
      coverageMessage = '1 category - expand for broader reach';
      quickWins.push({ tip: 'Add products in 2 more categories', points: 8 });
    } else if (categoryCount === 2) {
      coverageScore = 8;
      coverageStatus = 'needs-improvement';
      coverageMessage = '2 categories - add one more';
      quickWins.push({ tip: 'Add products in 1 more category', points: 5 });
    } else if (categoryCount === 3) {
      coverageScore = 11;
      coverageStatus = 'good';
      coverageMessage = '3 categories - good diversity';
    } else if (categoryCount === 4) {
      coverageScore = 13;
      coverageStatus = 'good';
      coverageMessage = '4 categories - very diverse';
    } else {
      coverageScore = 15;
      coverageStatus = 'excellent';
      coverageMessage = `${categoryCount} categories - excellent coverage!`;
    }

    factors.push({
      name: 'Category Coverage',
      score: coverageScore,
      maxScore: 15,
      status: coverageStatus,
      message: coverageMessage,
      tips: categoryCount < 3 ? ['Multi-category merchants see 2.1x more customer engagement'] : undefined,
    });

    // ============ Calculate Total Score ============
    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);

    let grade: 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';
    if (totalScore >= 80) grade = 'Excellent';
    else if (totalScore >= 60) grade = 'Good';
    else if (totalScore >= 40) grade = 'Fair';
    else grade = 'Needs Improvement';

    // Sort quick wins by points (highest first), limit to top 3
    quickWins.sort((a, b) => b.points - a.points);
    const topQuickWins = quickWins.slice(0, 3);

    console.log('[GetPerformanceScore] Score:', totalScore, 'Grade:', grade);
    const result: PerformanceScore = {
      totalScore,
      grade,
      factors,
      quickWins: topQuickWins,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-performance-score] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
