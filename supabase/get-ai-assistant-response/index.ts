/**
 * get-ai-assistant-response Edge Function
 * Provides conversational AI responses to merchant queries
 * Uses rule-based pattern matching (no LLM API costs)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface AssistantResponse {
  message: string;
  suggestions?: string[];
  actionButton?: {
    text: string;
    route: string;
  };
  data?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { merchantId, query } = await req.json();
    console.log('[GetAiAssistant] Query from merchant:', merchantId, '| query:', query?.substring(0, 80));

    if (!merchantId || !query) {
      return new Response(
        JSON.stringify({ error: 'merchantId and query are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedQuery = query.toLowerCase().trim();

    // Fetch merchant data for context
    const { data: products } = await supabase
      .from('products')
      .select('id, name, category, created_at')
      .eq('merchant_id', merchantId)
      .eq('is_active', true);

    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('campaign_id, status, created_at, end_date, offer_value, category')
      .eq('merchant_id', merchantId);

    const productCount = products?.length || 0;
    const campaignCount = campaigns?.length || 0;
    const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0;

    // Pattern matching for different query types
    let response: AssistantResponse;

    // ========== LAUNCH TIME QUERIES ==========
    if (normalizedQuery.includes('when') && (normalizedQuery.includes('launch') || normalizedQuery.includes('start') || normalizedQuery.includes('create'))) {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();

      let suggestion = '';
      if (dayOfWeek === 5 && hour < 18) {
        suggestion = 'Perfect timing! Launch a deal this Friday evening (6-8 PM) for maximum weekend visibility. Weekend deals get 3.8x more views.';
      } else if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        const daysUntil = 5 - dayOfWeek;
        suggestion = `I recommend launching your next deal on Friday evening (6-8 PM), which is ${daysUntil} day${daysUntil > 1 ? 's' : ''} away. This timing achieves 4.5x higher engagement.`;
      } else {
        suggestion = 'Launch your next deal on the upcoming Friday evening (6-8 PM) for optimal results. Our data shows this timing gets the best engagement.';
      }

      response = {
        message: suggestion,
        suggestions: [
          'What discount should I offer?',
          'Which products perform best?',
          'How often should I create deals?',
        ],
        actionButton: {
          text: 'Create Deal Now',
          route: '/merchant/campaigns',
        },
      };
    }
    // ========== PRODUCT PERFORMANCE QUERIES ==========
    else if (normalizedQuery.includes('product') && (normalizedQuery.includes('best') || normalizedQuery.includes('top') || normalizedQuery.includes('perform'))) {
      if (productCount === 0) {
        response = {
          message: 'You don\'t have any products yet. Add products to your catalogue to start tracking performance!',
          actionButton: {
            text: 'Add Products',
            route: '/merchant/catalogue',
          },
        };
      } else {
        const categoryMap: Record<string, number> = {};
        products?.forEach(p => {
          const cat = p.category || 'General';
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        });

        const topCategory = Object.entries(categoryMap)
          .sort(([, a], [, b]) => b - a)[0];

        response = {
          message: `You have ${productCount} active product${productCount > 1 ? 's' : ''} across ${Object.keys(categoryMap).length} categor${Object.keys(categoryMap).length === 1 ? 'y' : 'ies'}. Your strongest category is **${topCategory[0]}** with ${topCategory[1]} product${topCategory[1] > 1 ? 's' : ''}. Focus your deals here for best results!`,
          data: categoryMap,
          suggestions: [
            'What discount should I offer?',
            'How can I improve sales?',
            'When should I launch my next deal?',
          ],
          actionButton: {
            text: 'View AI Insights',
            route: '/merchant/ai-insights',
          },
        };
      }
    }
    // ========== DISCOUNT/PRICING QUERIES ==========
    else if (normalizedQuery.includes('discount') || normalizedQuery.includes('price') || normalizedQuery.includes('offer')) {
      if (productCount === 0) {
        response = {
          message: 'Add products first, then I can suggest optimal pricing strategies based on your categories!',
          actionButton: {
            text: 'Add Products',
            route: '/merchant/catalogue',
          },
        };
      } else {
        const categoryMap: Record<string, number> = {};
        products?.forEach(p => {
          const cat = p.category || 'General';
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        });

        const topCategory = Object.entries(categoryMap).sort(([, a], [, b]) => b - a)[0]?.[0] || 'General';

        const discountRecommendations: Record<string, { min: number; max: number; optimal: number }> = {
          'Electronics': { min: 10, max: 20, optimal: 15 },
          'Fashion': { min: 20, max: 30, optimal: 25 },
          'Food & Beverages': { min: 15, max: 25, optimal: 20 },
          'Sports': { min: 13, max: 23, optimal: 18 },
          'Beauty': { min: 17, max: 27, optimal: 22 },
          'General': { min: 15, max: 25, optimal: 20 },
        };

        const rec = discountRecommendations[topCategory] || discountRecommendations['General'];

        response = {
          message: `For your **${topCategory}** products, I recommend offering **${rec.min}%-${rec.max}%** discounts. The sweet spot is **${rec.optimal}%** - this generates 3.2x more engagement while maintaining healthy margins.`,
          suggestions: [
            'When should I launch this deal?',
            'How often should I create deals?',
            'Show me my performance',
          ],
          actionButton: {
            text: 'Create Deal',
            route: '/merchant/campaigns',
          },
        };
      }
    }
    // ========== DEAL FREQUENCY QUERIES ==========
    else if ((normalizedQuery.includes('how often') || normalizedQuery.includes('how many')) && normalizedQuery.includes('deal')) {
      response = {
        message: 'The ideal frequency is **2-3 deals per month**. Merchants who maintain this cadence see 5.7x more customer visits. Too many deals can dilute impact, while too few means missed opportunities.',
        data: {
          yourDeals: campaignCount,
          activeDeals: activeCampaigns,
        },
        suggestions: [
          'When should I launch my next deal?',
          'What discount should I offer?',
          'Show me my analytics',
        ],
        actionButton: activeCampaigns === 0 ? {
          text: 'Create Your First Deal',
          route: '/merchant/campaigns',
        } : undefined,
      };
    }
    // ========== IMPROVEMENT/SALES QUERIES ==========
    else if (normalizedQuery.includes('improve') || normalizedQuery.includes('increase') || normalizedQuery.includes('boost') || normalizedQuery.includes('grow')) {
      const tips = [];

      if (productCount < 5) {
        tips.push('📦 **Add more products** - Merchants with 10+ products see 2.4x broader reach');
      }
      if (activeCampaigns === 0) {
        tips.push('🎯 **Create active deals** - Launch 2-3 deals per month for optimal visibility');
      }
      if (productCount > 0) {
        tips.push('⏰ **Time it right** - Launch deals on Friday evenings (6-8 PM) for 4.5x higher engagement');
      }
      if (productCount > 0) {
        const categories = new Set(products?.map(p => p.category));
        if (categories.size < 3) {
          tips.push('🎨 **Diversify categories** - Expand to 3+ categories for broader customer appeal');
        }
      }

      response = {
        message: `Here are my top recommendations to boost your sales:\n\n${tips.join('\n\n')}`,
        suggestions: [
          'What discount should I offer?',
          'When should I launch my next deal?',
          'Show me detailed insights',
        ],
        actionButton: {
          text: 'View AI Insights Dashboard',
          route: '/merchant/ai-insights',
        },
      };
    }
    // ========== ANALYTICS/PERFORMANCE QUERIES ==========
    else if (normalizedQuery.includes('analytics') || normalizedQuery.includes('performance') || normalizedQuery.includes('how am i') || normalizedQuery.includes('stats')) {
      response = {
        message: `📊 **Your Quick Stats:**\n\n• **${productCount} active products**\n• **${campaignCount} total campaigns**\n• **${activeCampaigns} active deals**\n\nYour business is ${productCount < 5 ? 'growing - building foundation' : productCount < 15 ? 'emerging - gaining traction' : 'established - competitive player'}!`,
        suggestions: [
          'How can I improve sales?',
          'When should I launch my next deal?',
          'What discount should I offer?',
        ],
        actionButton: {
          text: 'View Full Analytics',
          route: '/merchant/analytics',
        },
      };
    }
    // ========== GREETING QUERIES ==========
    else if (normalizedQuery.includes('hello') || normalizedQuery.includes('hi ') || normalizedQuery.startsWith('hi') || normalizedQuery.includes('hey')) {
      response = {
        message: '👋 Hello! I\'m your AI assistant. I can help you with:\n\n• Best times to launch deals\n• Optimal pricing strategies\n• Product performance insights\n• Sales improvement tips\n\nWhat would you like to know?',
        suggestions: [
          'When should I launch my next deal?',
          'What discount should I offer?',
          'How can I improve sales?',
          'Show me my performance',
        ],
      };
    }
    // ========== CAMPAIGN DATE RULES QUERIES ==========
    else if (
      (normalizedQuery.includes('date') || normalizedQuery.includes('start date') || normalizedQuery.includes('end date') || normalizedQuery.includes('duration')) &&
      (normalizedQuery.includes('rule') || normalizedQuery.includes('requirement') || normalizedQuery.includes('policy') || normalizedQuery.includes('minimum') || normalizedQuery.includes('maximum') || normalizedQuery.includes('how long')) &&
      (normalizedQuery.includes('campaign') || normalizedQuery.includes('deal'))
    ) {
      response = {
        message: '📅 **Campaign Date Rules:**\n\n**Start Date:**\n• Must be at least **2 days** from today\n• This ensures better value for consumers and time for proper promotion\n\n**End Date:**\n• Must be **15 days** from the start date\n• This provides maximum consumer benefit and engagement window\n\n**Why these rules?**\n• 2-day minimum gives consumers advance notice\n• 15-day duration maximizes deal visibility\n• Longer deals perform 3.2x better than short ones\n\n💡 **Best timing:** Launch on Friday evenings (6-8 PM) for 4.5x better engagement!',
        actionButton: {
          text: 'Create Campaign',
          route: '/merchant/campaigns',
        },
        suggestions: [
          'How do I create a deal?',
          'What discount should I offer?',
          'When should I launch my next deal?',
        ],
      };
    }
    // ========== HOW TO CREATE/ADD QUERIES ==========
    else if ((normalizedQuery.includes('how') && (normalizedQuery.includes('create') || normalizedQuery.includes('add'))) || normalizedQuery.includes('how do i')) {
      if (normalizedQuery.includes('deal') || normalizedQuery.includes('campaign')) {
        response = {
          message: '📝 **How to Create a Deal:**\n\n1. Go to **Campaigns** page\n2. Click **"Create New Campaign"** button\n3. Fill in deal details:\n   • Product/service name\n   • Discount percentage\n   • **Start date:** At least 2 days from today\n   • **End date:** 15 days from start date\n   • Deal category\n   • Upload image\n4. Submit for review\n\n💡 **Important:** Start date should be minimum 2 days ahead to give better value. Deal runs for 15 days from start date for maximum consumer benefit!\n\n💡 **Best timing:** Launch on Friday evenings (6-8 PM) for 4.5x better engagement!',
          actionButton: {
            text: 'Go to Campaigns',
            route: '/merchant/campaigns',
          },
          suggestions: [
            'What discount should I offer?',
            'When should I launch my next deal?',
            'What are deal statuses?',
          ],
        };
      } else if (normalizedQuery.includes('product')) {
        response = {
          message: '📦 **How to Add Products:**\n\n1. Go to **Catalogue** page\n2. Click **"Add Product"** button\n3. Enter product details:\n   • Product name\n   • Category\n   • Upload image\n   • Description (optional)\n4. Save product\n\n💡 **Tip:** Add 10+ products for 2.4x broader reach!',
          actionButton: {
            text: 'Go to Catalogue',
            route: '/merchant/catalogue',
          },
          suggestions: [
            'How do I create a deal?',
            'What are the product categories?',
            'How can I improve sales?',
          ],
        };
      } else {
        response = {
          message: '🤔 I can help you with:\n\n• **Creating deals:** "How do I create a deal?"\n• **Adding products:** "How do I add products?"\n• **Managing profile:** "How do I edit my profile?"\n\nWhat would you like to know?',
          suggestions: [
            'How do I create a deal?',
            'How do I add products?',
            'Where is my profile?',
          ],
        };
      }
    }
    // ========== NAVIGATION QUERIES ==========
    else if (normalizedQuery.includes('where') || normalizedQuery.includes('find') || normalizedQuery.includes('navigate') || normalizedQuery.includes('go to')) {
      if (normalizedQuery.includes('campaign') || normalizedQuery.includes('deal')) {
        response = {
          message: '📍 Your **Campaigns** page shows all your deals (active, expired, pending review). You can create new deals, edit existing ones, and track performance there.',
          actionButton: {
            text: 'Go to Campaigns',
            route: '/merchant/campaigns',
          },
          suggestions: [
            'How do I create a deal?',
            'Where is my profile?',
            'Show me analytics',
          ],
        };
      } else if (normalizedQuery.includes('product') || normalizedQuery.includes('catalogue') || normalizedQuery.includes('catalog')) {
        response = {
          message: '📍 Your **Catalogue** page manages all your products. Add new products, edit details, and organize your inventory there.',
          actionButton: {
            text: 'Go to Catalogue',
            route: '/merchant/catalogue',
          },
          suggestions: [
            'How do I add products?',
            'Where are my campaigns?',
            'Show me analytics',
          ],
        };
      } else if (normalizedQuery.includes('analytics') || normalizedQuery.includes('stats') || normalizedQuery.includes('performance')) {
        response = {
          message: '📍 Your **Analytics** page shows detailed performance metrics, charts, and insights about your business.',
          actionButton: {
            text: 'Go to Analytics',
            route: '/merchant/analytics',
          },
          suggestions: [
            'Where are my campaigns?',
            'Show me AI insights',
            'How can I improve sales?',
          ],
        };
      } else if (normalizedQuery.includes('profile') || normalizedQuery.includes('account') || normalizedQuery.includes('settings')) {
        response = {
          message: '📍 Your **Profile** page lets you edit business details, contact info, and account settings. Access it from the menu.',
          suggestions: [
            'Where are my campaigns?',
            'Show me analytics',
            'How do I create a deal?',
          ],
        };
      } else if (normalizedQuery.includes('ai') || normalizedQuery.includes('insights')) {
        response = {
          message: '📍 The **AI Insights Dashboard** provides comprehensive business intelligence, including pricing strategies, demand forecasting, and category recommendations.',
          actionButton: {
            text: 'Go to AI Insights',
            route: '/merchant/ai-insights',
          },
          suggestions: [
            'What are AI insights?',
            'How can I improve sales?',
            'Show me analytics',
          ],
        };
      } else {
        response = {
          message: '📍 **Main Pages:**\n\n• **Campaigns** - Create and manage deals\n• **Catalogue** - Add and organize products\n• **Analytics** - View performance metrics\n• **AI Insights** - Get smart recommendations\n• **Profile** - Edit account details\n\nWhich page do you want to visit?',
          suggestions: [
            'Go to campaigns',
            'Go to catalogue',
            'Show me analytics',
          ],
        };
      }
    }
    // ========== FEATURE EXPLANATION QUERIES ==========
    else if (normalizedQuery.includes('what is') || normalizedQuery.includes('what are') || normalizedQuery.includes('explain')) {
      if (normalizedQuery.includes('deal of the day') || normalizedQuery.includes('dotd')) {
        response = {
          message: '⭐ **Deal of the Day** is a premium feature that showcases your deal on the main page for maximum visibility.\n\n**Benefits:**\n• Featured placement\n• 10-15x more views\n• Priority in search results\n• Limited slots per day\n\n**How to get it:** Available with Premium subscription or as an add-on.',
          suggestions: [
            'How do I create a deal?',
            'What are the subscription plans?',
            'When should I launch my next deal?',
          ],
        };
      } else if (normalizedQuery.includes('subscription') || normalizedQuery.includes('plan')) {
        response = {
          message: '💳 **Subscription Plans:**\n\n• **Basic** - 5 deals/month\n• **Pro** - 15 deals/month + analytics\n• **Premium** - Unlimited deals + AI insights + Deal of the Day\n\nAll plans include product catalogue and customer engagement tools.',
          suggestions: [
            'How do I upgrade?',
            'What is Deal of the Day?',
            'How can I improve sales?',
          ],
        };
      } else if (normalizedQuery.includes('needs review') || (normalizedQuery.includes('need') && normalizedQuery.includes('review'))) {
        response = {
          message: '🔄 **"Needs Review" Status:**\n\nThis means the administrator has reviewed your campaign and requested corrections.\n\n**What to do:**\n1. Go to **Campaigns** page\n2. Click on **"Needs Review"** tab\n3. Find your campaign there\n4. **Look for admin comments** displayed just below the campaign details\n5. Make the requested corrections\n6. Resubmit for review\n\n💡 Admin comments tell you exactly what needs to be fixed!',
          actionButton: {
            text: 'Go to Campaigns',
            route: '/merchant/campaigns',
          },
          suggestions: [
            'How do I create a deal?',
            'What are other deal statuses?',
            'Where are my campaigns?',
          ],
        };
      } else if (normalizedQuery.includes('status') && normalizedQuery.includes('deal')) {
        response = {
          message: '📊 **Deal Statuses:**\n\n• **Pending Review** - Waiting for admin approval\n• **Active** - Live and visible to customers\n• **Expired** - Past end date\n• **Needs Review** - Admin requested corrections (check comments in campaign)\n\n💡 Most deals get approved within 24 hours!',
          suggestions: [
            'How do I create a deal?',
            'When should I launch my next deal?',
            'What is needs review status?',
          ],
        };
      } else if (normalizedQuery.includes('ai insights') || normalizedQuery.includes('ai dashboard')) {
        response = {
          message: '🤖 **AI Insights** analyzes your business data to provide:\n\n• Product description optimization\n• Category-specific pricing strategies\n• Demand forecasting\n• Performance predictions\n• Competitor positioning\n• Category expansion recommendations\n\nAll powered by smart algorithms - no AI API costs!',
          actionButton: {
            text: 'View AI Insights',
            route: '/merchant/ai-insights',
          },
          suggestions: [
            'How can I improve sales?',
            'What discount should I offer?',
            'Show me my performance',
          ],
        };
      } else {
        response = {
          message: '💡 I can explain:\n\n• **Features:** "What is Deal of the Day?"\n• **Plans:** "What are the subscription plans?"\n• **Statuses:** "What are deal statuses?"\n• **AI Tools:** "What is AI Insights?"\n\nWhat would you like to know about?',
          suggestions: [
            'What is Deal of the Day?',
            'What are the subscription plans?',
            'What is AI Insights?',
          ],
        };
      }
    }
    // ========== STUCK/PROBLEM QUERIES ==========
    else if (normalizedQuery.includes('stuck') || normalizedQuery.includes('problem') || normalizedQuery.includes('issue') || normalizedQuery.includes('error') || normalizedQuery.includes('not working')) {
      response = {
        message: '🆘 **I\'m here to help!** Common issues:\n\n• **Can\'t create deal?** Check that you have products in your catalogue first\n• **Deal pending review?** Approval typically takes < 24 hours\n• **Subscription expired?** Visit Subscriptions page to renew\n• **Need immediate help?** Contact support@dealpro.com\n\nWhat specific issue are you facing?',
        suggestions: [
          'How do I create a deal?',
          'How do I add products?',
          'Where is my profile?',
        ],
      };
    }
    // ========== HELP QUERIES ==========
    else if (normalizedQuery.includes('help') || normalizedQuery === 'what can you do') {
      response = {
        message: '🤖 I\'m your complete assistant! Ask me about:\n\n**📊 Business Insights:**\n• "When should I launch my next deal?"\n• "What discount should I offer?"\n• "How can I improve sales?"\n\n**🧭 Navigation:**\n• "Where are my campaigns?"\n• "Show me analytics"\n\n**📚 How-To Guides:**\n• "How do I create a deal?"\n• "How do I add products?"\n\n**💡 Feature Explanations:**\n• "What is Deal of the Day?"\n• "What are AI insights?"\n\nJust ask naturally!',
        suggestions: [
          'How do I create a deal?',
          'What discount should I offer?',
          'Where are my campaigns?',
          'How can I improve sales?',
        ],
      };
    }
    // ========== DEFAULT/UNCLEAR QUERIES ==========
    else {
      response = {
        message: 'I\'m not sure I understood that. I can help you with:\n\n• Launch timing for deals\n• Pricing & discount strategies\n• Product performance analysis\n• Sales improvement tips\n\nTry asking something like "When should I launch my next deal?" or "What discount should I offer?"',
        suggestions: [
          'When should I launch my next deal?',
          'What discount should I offer?',
          'Which products perform best?',
          'How can I improve sales?',
        ],
      };
    }

    return new Response(
      JSON.stringify({ response }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-ai-assistant-response] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
