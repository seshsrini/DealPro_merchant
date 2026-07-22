/**
 * get-ai-insights Edge Function
 * Generates AI-powered recommendations for merchants
 * including pricing optimization, best launch times, and actionable insights
 *
 * i18n: titles, recommendations and action labels are rendered in the merchant's
 * locale via makeT() from ../_shared/analyticsI18n.ts. The `impact` and `type`
 * enums stay in English — the client maps `impact` to a localized badge and uses
 * `type` for icon selection.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { makeT } from '../_shared/analyticsI18n.ts';

interface AIInsight {
  id: string;
  type: 'pricing' | 'timing' | 'action' | 'category' | 'engagement';
  title: string;
  recommendation: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number; // 0-100
  actionText?: string;
  actionRoute?: string;
}

interface ProductData {
  id: string;
  name: string;
  category: string;
  created_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { merchantId, locale } = await req.json();
    const T = makeT(locale || 'en');
    console.log('[GetAiInsights] Generating insights for merchant:', merchantId, 'locale:', locale || 'en');

    if (!merchantId) {
      return new Response(
        JSON.stringify({ error: 'merchantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const insights: AIInsight[] = [];

    // Fetch merchant's products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, category, created_at')
      .eq('merchant_id', merchantId)
      .eq('is_active', true);

    if (productsError) throw productsError;

    const productCount = products?.length || 0;

    // Fetch merchant's campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('campaign_id, status, created_at, end_date')
      .eq('merchant_id', merchantId);

    if (campaignsError) throw campaignsError;

    const campaignCount = campaigns?.length || 0;
    const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0;

    // ============ AI Insight #1: Pricing Optimization ============
    if (productCount > 0) {
      // Analyze product categories to suggest optimal discounts
      const categoryMap: Record<string, number> = {};
      products?.forEach((p: ProductData) => {
        const cat = p.category || 'General';
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      });

      const topCategory = Object.entries(categoryMap)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'General';

      // Category-based discount recommendations
      const discountRecommendations: Record<string, number> = {
        'Electronics': 15,
        'Fashion': 25,
        'Food & Beverages': 20,
        'Sports': 18,
        'Beauty': 22,
        'Home & Garden': 20,
        'General': 20,
      };

      const recommendedDiscount = discountRecommendations[topCategory] || 20;

      insights.push({
        id: 'pricing-optimization',
        type: 'pricing',
        title: T('ai_t_pricing'),
        recommendation: T('ai_r_pricing', { cat: topCategory, lo: recommendedDiscount - 5, hi: recommendedDiscount + 5 }),
        impact: 'high',
        confidence: 87,
        actionText: T('ai_a_create_deal'),
        actionRoute: '/merchant/campaigns',
      });
    }

    // ============ AI Insight #2: Best Launch Time ============
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday
    const hour = now.getHours();

    // Determine next optimal launch time
    let bestDay = '';
    let bestTime = '';
    let daysUntil = 0;

    if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      // Monday-Thursday: Recommend Friday evening
      bestDay = T('ai_day_friday');
      bestTime = T('ai_time_evening');
      daysUntil = 5 - dayOfWeek;
    } else if (dayOfWeek === 5) {
      // Friday: Recommend this evening
      bestDay = T('ai_day_today_friday');
      bestTime = T('ai_time_evening');
      daysUntil = 0;
    } else {
      // Weekend: Recommend next Friday
      bestDay = T('ai_day_next_friday');
      bestTime = T('ai_time_evening');
      daysUntil = 5 + (7 - dayOfWeek);
    }

    insights.push({
      id: 'best-launch-time',
      type: 'timing',
      title: T('ai_t_timing'),
      recommendation: T('ai_r_timing', { day: bestDay, time: bestTime }),
      impact: 'high',
      confidence: 92,
      actionText: daysUntil === 0 ? T('ai_a_create_deal_now') : T('ai_a_schedule_deal'),
      actionRoute: '/merchant/campaigns',
    });

    // ============ AI Insight #3: Product Refresh Recommendation ============
    if (productCount > 0 && products) {
      const recentProducts = products.filter((p: ProductData) => {
        const createdAt = new Date(p.created_at);
        const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince <= 7;
      }).length;

      if (recentProducts === 0) {
        insights.push({
          id: 'product-refresh',
          type: 'action',
          title: T('ai_t_refresh'),
          recommendation: T('ai_r_refresh'),
          impact: 'medium',
          confidence: 78,
          actionText: T('ai_a_add_products'),
          actionRoute: '/merchant/catalogue',
        });
      }
    }

    // ============ AI Insight #4: Deal Velocity Recommendation ============
    if (campaignCount > 0 && campaigns && campaigns.length > 0) {
      const avgDealsPerMonth = campaignCount / Math.max(1, Math.ceil(
        (Date.now() - new Date(campaigns[0].created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
      ));

      if (avgDealsPerMonth < 2) {
        insights.push({
          id: 'deal-velocity',
          type: 'action',
          title: T('ai_t_velocity'),
          recommendation: T('ai_r_velocity'),
          impact: 'high',
          confidence: 84,
          actionText: T('ai_a_create_deal'),
          actionRoute: '/merchant/campaigns',
        });
      }
    } else if (productCount > 0) {
      insights.push({
        id: 'first-deal',
        type: 'action',
        title: T('ai_t_first_deal'),
        recommendation: T('ai_r_first_deal'),
        impact: 'high',
        confidence: 95,
        actionText: T('ai_a_create_deal'),
        actionRoute: '/merchant/campaigns',
      });
    }

    // ============ AI Insight #5: Category Expansion ============
    if (productCount > 5) {
      const uniqueCategories = new Set(products?.map((p: ProductData) => p.category || 'General'));

      if (uniqueCategories.size < 3) {
        insights.push({
          id: 'category-expansion',
          type: 'category',
          title: T('ai_t_diversify'),
          recommendation: uniqueCategories.size === 1
            ? T('ai_r_diversify_one')
            : T('ai_r_diversify_many', { n: uniqueCategories.size }),
          impact: 'medium',
          confidence: 72,
          actionText: T('ai_a_add_products'),
          actionRoute: '/merchant/catalogue',
        });
      }
    }

    // ============ AI Insight #6: Weekend Strategy ============
    if (dayOfWeek === 5 && hour < 18) {
      insights.push({
        id: 'weekend-prep',
        type: 'timing',
        title: T('ai_t_weekend'),
        recommendation: T('ai_r_weekend'),
        impact: 'high',
        confidence: 89,
        actionText: T('ai_a_create_weekend'),
        actionRoute: '/merchant/campaigns',
      });
    }

    // Sort by impact and confidence
    const impactWeight = { high: 3, medium: 2, low: 1 };
    const sortedInsights = insights.sort((a, b) => {
      const scoreA = impactWeight[a.impact] * (a.confidence / 100);
      const scoreB = impactWeight[b.impact] * (b.confidence / 100);
      return scoreB - scoreA;
    });

    // Return top 5 insights
    return new Response(
      JSON.stringify({ insights: sortedInsights.slice(0, 5) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-ai-insights] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
