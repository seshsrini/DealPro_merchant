/**
 * get-performance-score Edge Function
 * Calculates comprehensive merchant performance score (0-100)
 * Based on: Product Portfolio, Campaign Activity, Launch Timing, Pricing, Engagement, Category Coverage
 *
 * i18n: display prose (factor names, messages, tips, quick-win tips) is rendered
 * in the merchant's locale via makeT() from ../_shared/analyticsI18n.ts. The
 * `grade` and factor `status` enums stay in English on purpose — the client uses
 * them for styling/logic and maps `grade` to a localized label itself.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { makeT } from '../_shared/analyticsI18n.ts';

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

    const { merchantId, locale } = await req.json();
    const T = makeT(locale || 'en');
    console.log('[GetPerformanceScore] Calculating score for merchant:', merchantId, 'locale:', locale || 'en');

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
      productMessage = T('ps_prod_none');
      quickWins.push({ tip: T('ps_qw_first5'), points: 10 });
    } else if (productCount < 5) {
      productScore = 5;
      productStatus = 'needs-improvement';
      productMessage = T('ps_prod_few', { n: productCount });
      quickWins.push({ tip: T('ps_qw_reach10', { n: 10 - productCount }), points: 10 });
    } else if (productCount < 10) {
      productScore = 10;
      productStatus = 'good';
      productMessage = T('ps_prod_good', { n: productCount });
      quickWins.push({ tip: T('ps_qw_addmore', { n: 10 - productCount }), points: 5 });
    } else if (productCount < 20) {
      productScore = 15;
      productStatus = 'good';
      productMessage = T('ps_prod_solid', { n: productCount });
    } else {
      productScore = 20;
      productStatus = 'excellent';
      productMessage = T('ps_prod_excellent', { n: productCount });
    }

    // Category diversity bonus
    const categories = new Set(products?.map(p => p.category));
    const categoryCount = categories.size;

    factors.push({
      name: T('ps_name_portfolio'),
      score: productScore,
      maxScore: 20,
      status: productStatus,
      message: productMessage,
      tips: categoryCount < 3 ? [T('ps_tip_categories', { n: 3 - categoryCount })] : undefined,
    });

    // ============ FACTOR 2: Campaign Activity (0-20 points) ============
    let campaignScore = 0;
    let campaignStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let campaignMessage = '';

    if (campaignCount === 0) {
      campaignMessage = T('ps_camp_none');
      quickWins.push({ tip: T('ps_qw_first_campaign'), points: 10 });
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
        campaignMessage = T('ps_camp_low', { n: campaignCount });
        quickWins.push({ tip: T('ps_qw_23month'), points: 8 });
      } else if (dealsPerMonth < 2) {
        campaignScore = 12;
        campaignStatus = 'good';
        campaignMessage = T('ps_camp_good', { n: dealsPerMonth.toFixed(1) });
        quickWins.push({ tip: T('ps_qw_aim23'), points: 5 });
      } else if (dealsPerMonth <= 3) {
        campaignScore = 18;
        campaignStatus = 'excellent';
        campaignMessage = T('ps_camp_excellent', { n: dealsPerMonth.toFixed(1) });
      } else {
        campaignScore = 20;
        campaignStatus = 'excellent';
        campaignMessage = T('ps_camp_veryactive', { n: dealsPerMonth.toFixed(1) });
      }

      // Active campaigns bonus
      if (activeCampaigns > 0) {
        campaignScore = Math.min(20, campaignScore + 2);
      } else if (campaignCount > 0) {
        quickWins.push({ tip: T('ps_qw_new_active'), points: 5 });
      }
    }

    factors.push({
      name: T('ps_name_activity'),
      score: campaignScore,
      maxScore: 20,
      status: campaignStatus,
      message: campaignMessage,
      tips: activeCampaigns === 0 && campaignCount > 0 ? [T('ps_tip_no_active')] : undefined,
    });

    // ============ FACTOR 3: Launch Timing (0-15 points) ============
    let timingScore = 0;
    let timingStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let timingMessage = '';

    if (campaignCount === 0) {
      timingMessage = T('ps_no_campaigns');
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
        timingMessage = T('ps_time_none');
        quickWins.push({ tip: T('ps_qw_friday_eve'), points: 8 });
      } else if (fridayPercent < 30) {
        timingScore = 8;
        timingStatus = 'needs-improvement';
        timingMessage = T('ps_time_low', { n: fridayPercent.toFixed(0) });
        quickWins.push({ tip: T('ps_qw_more_friday'), points: 5 });
      } else if (fridayPercent < 60) {
        timingScore = 11;
        timingStatus = 'good';
        timingMessage = T('ps_time_good', { n: fridayPercent.toFixed(0) });
      } else {
        timingScore = 15;
        timingStatus = 'excellent';
        timingMessage = T('ps_time_excellent', { n: fridayPercent.toFixed(0) });
      }
    }

    factors.push({
      name: T('ps_name_timing'),
      score: timingScore,
      maxScore: 15,
      status: timingStatus,
      message: timingMessage,
      tips: timingScore < 10 ? [T('ps_tip_friday')] : undefined,
    });

    // ============ FACTOR 4: Pricing Strategy (0-15 points) ============
    let pricingScore = 0;
    let pricingStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let pricingMessage = '';

    if (campaignCount === 0) {
      pricingMessage = T('ps_no_campaigns');
    } else {
      // Analyze discount ranges
      const discounts = campaigns?.map(c => c.offer_value || 0) || [];
      const avgDiscount = discounts.reduce((a, b) => a + b, 0) / discounts.length;

      const optimalDiscounts = discounts.filter(d => d >= 10 && d <= 30).length;
      const optimalPercent = (optimalDiscounts / campaignCount) * 100;

      if (optimalPercent === 0) {
        pricingScore = 5;
        pricingStatus = 'needs-improvement';
        pricingMessage = T('ps_price_none');
        quickWins.push({ tip: T('ps_qw_1030'), points: 7 });
      } else if (optimalPercent < 50) {
        pricingScore = 8;
        pricingStatus = 'needs-improvement';
        pricingMessage = T('ps_price_mid', { n: optimalPercent.toFixed(0) });
      } else if (optimalPercent < 80) {
        pricingScore = 11;
        pricingStatus = 'good';
        pricingMessage = T('ps_price_mid', { n: optimalPercent.toFixed(0) });
      } else {
        pricingScore = 15;
        pricingStatus = 'excellent';
        pricingMessage = T('ps_price_excellent', { n: optimalPercent.toFixed(0) });
      }
    }

    factors.push({
      name: T('ps_name_pricing'),
      score: pricingScore,
      maxScore: 15,
      status: pricingStatus,
      message: pricingMessage,
      tips: pricingScore < 10 ? [T('ps_tip_discount')] : undefined,
    });

    // ============ FACTOR 5: Engagement (0-15 points) ============
    let engagementScore = 0;
    let engagementStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let engagementMessage = '';

    if (campaignCount === 0) {
      engagementMessage = T('ps_no_campaigns');
    } else {
      // Approval rate
      const approvalRate = (approvedCampaigns / campaignCount) * 100;

      if (approvalRate < 50) {
        engagementScore = 5;
        engagementStatus = 'needs-improvement';
        engagementMessage = T('ps_eng_low', { n: approvalRate.toFixed(0) });
      } else if (approvalRate < 75) {
        engagementScore = 9;
        engagementStatus = 'good';
        engagementMessage = T('ps_eng_good', { n: approvalRate.toFixed(0) });
      } else if (approvalRate < 90) {
        engagementScore = 12;
        engagementStatus = 'good';
        engagementMessage = T('ps_eng_excellent', { n: approvalRate.toFixed(0) });
      } else {
        engagementScore = 15;
        engagementStatus = 'excellent';
        engagementMessage = T('ps_eng_outstanding', { n: approvalRate.toFixed(0) });
      }
    }

    factors.push({
      name: T('ps_name_engagement'),
      score: engagementScore,
      maxScore: 15,
      status: engagementStatus,
      message: engagementMessage,
      tips: engagementScore < 10 ? [T('ps_tip_approval')] : undefined,
    });

    // ============ FACTOR 6: Category Coverage (0-15 points) ============
    let coverageScore = 0;
    let coverageStatus: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
    let coverageMessage = '';

    if (categoryCount === 0) {
      coverageMessage = T('ps_cov_none');
    } else if (categoryCount === 1) {
      coverageScore = 5;
      coverageStatus = 'needs-improvement';
      coverageMessage = T('ps_cov_1');
      quickWins.push({ tip: T('ps_qw_2cats'), points: 8 });
    } else if (categoryCount === 2) {
      coverageScore = 8;
      coverageStatus = 'needs-improvement';
      coverageMessage = T('ps_cov_2');
      quickWins.push({ tip: T('ps_qw_1cat'), points: 5 });
    } else if (categoryCount === 3) {
      coverageScore = 11;
      coverageStatus = 'good';
      coverageMessage = T('ps_cov_3');
    } else if (categoryCount === 4) {
      coverageScore = 13;
      coverageStatus = 'good';
      coverageMessage = T('ps_cov_4');
    } else {
      coverageScore = 15;
      coverageStatus = 'excellent';
      coverageMessage = T('ps_cov_many', { n: categoryCount });
    }

    factors.push({
      name: T('ps_name_coverage'),
      score: coverageScore,
      maxScore: 15,
      status: coverageStatus,
      message: coverageMessage,
      tips: categoryCount < 3 ? [T('ps_tip_multicategory')] : undefined,
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
