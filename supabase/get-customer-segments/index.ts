/**
 * get-customer-segments Edge Function
 * Analyzes and segments merchant's customer base
 * Provides insights into customer behavior and preferences
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  count: number;
  percentage: number;
  avgRedemptions: number;
  preferredDiscount: string;
  topCategory: string;
  peakTime: string;
  recommendation: string;
  value: 'high' | 'medium' | 'low';
}

interface SegmentationInsights {
  totalCustomers: number;
  segments: CustomerSegment[];
  engagementStatus: {
    active: number;
    occasional: number;
    dormant: number;
  };
  categoryPreferences: Record<string, Record<string, number>>;
  topInsights: string[];
  recommendations: string[];
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

    // Fetch merchant's campaigns to get deal claims
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('campaign_id, category, offer_value, created_at')
      .eq('merchant_id', merchantId);

    if (!campaigns || campaigns.length === 0) {
      // No campaigns yet, return empty insights
      return new Response(
        JSON.stringify({
          totalCustomers: 0,
          segments: [],
          engagementStatus: { active: 0, occasional: 0, dormant: 0 },
          categoryPreferences: {},
          topInsights: ['No customer data yet. Create campaigns to start gathering insights!'],
          recommendations: ['Launch your first campaign to attract customers'],
        } as SegmentationInsights),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const campaignIds = campaigns.map(c => c.campaign_id);

    // Fetch deal claims for these campaigns
    const { data: claims } = await supabase
      .from('deal_claims')
      .select('consumer_id, campaign_id, claimed_at')
      .in('campaign_id', campaignIds);

    // Fetch favorites for engagement analysis
    const { data: favorites } = await supabase
      .from('product_favorites')
      .select('consumer_id, product_id, created_at')
      .in('product_id', (await supabase
        .from('products')
        .select('id')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
      ).data?.map(p => p.id) || []);

    // Analyze customer behavior
    const customerData: Record<string, {
      redemptions: number;
      categories: string[];
      discounts: number[];
      lastActivity: Date;
      favoriteCount: number;
    }> = {};

    // Process claims
    claims?.forEach(claim => {
      if (!customerData[claim.consumer_id]) {
        customerData[claim.consumer_id] = {
          redemptions: 0,
          categories: [],
          discounts: [],
          lastActivity: new Date(claim.claimed_at),
          favoriteCount: 0,
        };
      }

      const campaign = campaigns.find(c => c.campaign_id === claim.campaign_id);
      if (campaign) {
        customerData[claim.consumer_id].redemptions++;
        customerData[claim.consumer_id].categories.push(campaign.category || 'General');
        customerData[claim.consumer_id].discounts.push(campaign.offer_value || 0);

        const claimDate = new Date(claim.claimed_at);
        if (claimDate > customerData[claim.consumer_id].lastActivity) {
          customerData[claim.consumer_id].lastActivity = claimDate;
        }
      }
    });

    // Process favorites
    favorites?.forEach(fav => {
      if (!customerData[fav.consumer_id]) {
        customerData[fav.consumer_id] = {
          redemptions: 0,
          categories: [],
          discounts: [],
          lastActivity: new Date(fav.created_at),
          favoriteCount: 1,
        };
      } else {
        customerData[fav.consumer_id].favoriteCount++;
      }
    });

    const totalCustomers = Object.keys(customerData).length;

    if (totalCustomers === 0) {
      return new Response(
        JSON.stringify({
          totalCustomers: 0,
          segments: [],
          engagementStatus: { active: 0, occasional: 0, dormant: 0 },
          categoryPreferences: {},
          topInsights: ['No customer engagement yet. Promote your campaigns to attract customers!'],
          recommendations: ['Share your deals on social media', 'Offer competitive discounts (15-25%)'],
        } as SegmentationInsights),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate segments
    const now = new Date();
    const segments: CustomerSegment[] = [];

    // Segment by value (based on redemptions)
    const customerValues = Object.entries(customerData).map(([id, data]) => ({
      id,
      redemptions: data.redemptions,
      avgDiscount: data.discounts.length > 0 ? data.discounts.reduce((a, b) => a + b, 0) / data.discounts.length : 0,
      topCategory: data.categories.length > 0
        ? data.categories.sort((a, b) =>
            data.categories.filter(c => c === b).length - data.categories.filter(c => c === a).length
          )[0]
        : 'General',
      daysSinceLastActivity: Math.floor((now.getTime() - data.lastActivity.getTime()) / (1000 * 60 * 60 * 24)),
    }));

    // Sort by redemptions
    customerValues.sort((a, b) => b.redemptions - a.redemptions);

    // High-value customers (top 20%)
    const highValueCount = Math.max(1, Math.floor(totalCustomers * 0.2));
    const highValueCustomers = customerValues.slice(0, highValueCount);
    const highValueRedemptions = highValueCustomers.reduce((sum, c) => sum + c.redemptions, 0);

    segments.push({
      id: 'high-value',
      name: 'High-Value Customers',
      description: 'Your most engaged customers',
      count: highValueCount,
      percentage: Math.round((highValueCount / totalCustomers) * 100),
      avgRedemptions: Number((highValueRedemptions / highValueCount).toFixed(1)),
      preferredDiscount: highValueCustomers.length > 0
        ? `${Math.round(highValueCustomers.reduce((sum, c) => sum + c.avgDiscount, 0) / highValueCustomers.length)}%`
        : '15-20%',
      topCategory: highValueCustomers[0]?.topCategory || 'General',
      peakTime: 'Friday 6-8 PM',
      recommendation: 'Launch premium deals on Friday evenings. These customers drive most of your revenue.',
      value: 'high',
    });

    // Medium-value customers (next 50%)
    const mediumValueCount = Math.max(1, Math.floor(totalCustomers * 0.5));
    const mediumValueCustomers = customerValues.slice(highValueCount, highValueCount + mediumValueCount);
    const mediumValueRedemptions = mediumValueCustomers.reduce((sum, c) => sum + c.redemptions, 0);

    segments.push({
      id: 'medium-value',
      name: 'Medium-Value Customers',
      description: 'Regular customers with growth potential',
      count: mediumValueCount,
      percentage: Math.round((mediumValueCount / totalCustomers) * 100),
      avgRedemptions: mediumValueCustomers.length > 0 ? Number((mediumValueRedemptions / mediumValueCount).toFixed(1)) : 0,
      preferredDiscount: mediumValueCustomers.length > 0
        ? `${Math.round(mediumValueCustomers.reduce((sum, c) => sum + c.avgDiscount, 0) / mediumValueCustomers.length)}%`
        : '20-25%',
      topCategory: mediumValueCustomers[0]?.topCategory || 'Food & Beverage',
      peakTime: 'Weekend mornings',
      recommendation: 'Weekend deals with moderate discounts (20-25%) can convert these to high-value.',
      value: 'medium',
    });

    // Low-value customers (remaining 30%)
    const lowValueCustomers = customerValues.slice(highValueCount + mediumValueCount);
    const lowValueRedemptions = lowValueCustomers.reduce((sum, c) => sum + c.redemptions, 0);

    segments.push({
      id: 'low-value',
      name: 'Casual Customers',
      description: 'Occasional buyers seeking big discounts',
      count: lowValueCustomers.length,
      percentage: Math.round((lowValueCustomers.length / totalCustomers) * 100),
      avgRedemptions: lowValueCustomers.length > 0 ? Number((lowValueRedemptions / lowValueCustomers.length).toFixed(1)) : 0,
      preferredDiscount: '25-30%',
      topCategory: lowValueCustomers[0]?.topCategory || 'Fashion',
      peakTime: 'Weekend afternoons',
      recommendation: 'Flash sales with deeper discounts can increase engagement from this segment.',
      value: 'low',
    });

    // Engagement status
    const activeCustomers = customerValues.filter(c => c.daysSinceLastActivity <= 7).length;
    const occasionalCustomers = customerValues.filter(c => c.daysSinceLastActivity > 7 && c.daysSinceLastActivity <= 30).length;
    const dormantCustomers = customerValues.filter(c => c.daysSinceLastActivity > 30).length;

    // Category preferences by segment
    const categoryPreferences: Record<string, Record<string, number>> = {
      'High-Value': {},
      'Medium-Value': {},
      'Low-Value': {},
    };

    highValueCustomers.forEach(c => {
      categoryPreferences['High-Value'][c.topCategory] = (categoryPreferences['High-Value'][c.topCategory] || 0) + 1;
    });

    mediumValueCustomers.forEach(c => {
      categoryPreferences['Medium-Value'][c.topCategory] = (categoryPreferences['Medium-Value'][c.topCategory] || 0) + 1;
    });

    lowValueCustomers.forEach(c => {
      categoryPreferences['Low-Value'][c.topCategory] = (categoryPreferences['Low-Value'][c.topCategory] || 0) + 1;
    });

    // Top insights
    const topInsights: string[] = [];

    const highValuePercentage = Math.round((highValueRedemptions / (highValueRedemptions + mediumValueRedemptions + lowValueRedemptions)) * 100);
    topInsights.push(`Top ${Math.round((highValueCount / totalCustomers) * 100)}% customers generate ${highValuePercentage}% of redemptions`);

    if (dormantCustomers > totalCustomers * 0.2) {
      topInsights.push(`${dormantCustomers} customers (${Math.round((dormantCustomers / totalCustomers) * 100)}%) are dormant - potential for re-engagement`);
    }

    topInsights.push(`Most active time: ${activeCustomers > totalCustomers * 0.3 ? 'High' : 'Moderate'} weekly activity`);

    // Recommendations
    const recommendations: string[] = [];

    if (dormantCustomers > 0) {
      recommendations.push(`Launch a win-back campaign with 25%+ discounts for ${dormantCustomers} dormant customers`);
    }

    recommendations.push(`Focus Friday evening deals on ${highValueCustomers[0]?.topCategory || 'top category'} for high-value segment`);

    if (mediumValueCount > highValueCount) {
      recommendations.push(`Weekend promotions can convert ${mediumValueCount} medium-value customers to high-value`);
    }

    const result: SegmentationInsights = {
      totalCustomers,
      segments,
      engagementStatus: {
        active: activeCustomers,
        occasional: occasionalCustomers,
        dormant: dormantCustomers,
      },
      categoryPreferences,
      topInsights,
      recommendations,
    };

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-customer-segments] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
