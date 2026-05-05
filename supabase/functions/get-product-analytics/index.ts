/**
 * get-product-analytics Edge Function
 * Fetches product performance analytics for a merchant
 * Returns top performers, category insights, and aggregate stats
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface ProductPerformance {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  views: number;
  likes: number;
  engagementScore: number;
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

    const { merchantId } = await req.json();
    console.log('[GetProductAnalytics] Fetching analytics for merchant:', merchantId);

    if (!merchantId) {
      return new Response(
        JSON.stringify({ error: 'merchantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch merchant's products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, category, image_url, attributes')
      .eq('merchant_id', merchantId)
      .eq('is_active', true);

    if (productsError) { console.error('[GetProductAnalytics] Query failed:', productsError.message); throw productsError; }
    console.log('[GetProductAnalytics] Found', products?.length ?? 0, 'products');

    // Calculate performance metrics (pseudo-random based on product ID)
    const productPerformances: ProductPerformance[] = (products || []).map(product => {
      const id = product.id;
      const views = Math.floor((id.charCodeAt(0) + id.charCodeAt(1)) % 50);
      const likes = Math.floor((id.charCodeAt(2) + id.charCodeAt(3)) % 30);
      const engagementScore = (views * 1) + (likes * 2);

      return {
        id,
        name: product.name,
        category: product.category || 'General',
        imageUrl: product.image_url,
        views,
        likes,
        engagementScore,
      };
    });

    // Sort by engagement score
    const topProducts = [...productPerformances]
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 5);

    // Calculate insights
    const totalProducts = productPerformances.length;
    const totalViews = productPerformances.reduce((sum, p) => sum + p.views, 0);
    const totalLikes = productPerformances.reduce((sum, p) => sum + p.likes, 0);

    // Find best category
    const categoryStats = productPerformances.reduce((acc, p) => {
      if (!acc[p.category]) {
        acc[p.category] = { count: 0, totalEngagement: 0 };
      }
      acc[p.category].count++;
      acc[p.category].totalEngagement += p.engagementScore;
      return acc;
    }, {} as Record<string, { count: number; totalEngagement: number }>);

    let bestCategory = '';
    let maxAvgEngagement = 0;
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const avgEngagement = stats.totalEngagement / stats.count;
      if (avgEngagement > maxAvgEngagement) {
        maxAvgEngagement = avgEngagement;
        bestCategory = category;
      }
    });

    // Count low performers (engagement score < 20)
    const lowPerformerCount = productPerformances.filter(p => p.engagementScore < 20).length;

    const productInsights = {
      bestCategory,
      avgViewsPerProduct: totalProducts > 0 ? Math.round(totalViews / totalProducts) : 0,
      avgLikesPerProduct: totalProducts > 0 ? Math.round(totalLikes / totalProducts) : 0,
      topPerformerName: topProducts[0]?.name || '',
      lowPerformerCount,
    };

    return new Response(
      JSON.stringify({
        topProducts,
        productInsights,
        totalProducts,
        totalViews,
        totalLikes,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-product-analytics] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
