/**
 * save-campaign-template Edge Function
 * Saves a successful campaign as a reusable template
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { merchantId, templateName, templateDescription, campaignData } = await req.json();
    console.log('[SaveCampaignTemplate] Saving template:', templateName, 'for merchant:', merchantId);

    if (!merchantId || !templateName || !campaignData) {
      return new Response(
        JSON.stringify({ error: 'merchantId, templateName, and campaignData are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract template values from campaign data
    const launchDate = campaignData.launch_date ? new Date(campaignData.launch_date) : null;
    const endDate = campaignData.end_date ? new Date(campaignData.end_date) : null;

    const duration = launchDate && endDate
      ? Math.ceil((endDate.getTime() - launchDate.getTime()) / (1000 * 60 * 60 * 24))
      : 15;

    // Create title format (replace product-specific text with placeholder)
    let titleFormat = campaignData.title || '[Product] - Special Offer!';
    // Remove specific product names if we can detect them
    // This is a simple approach - could be enhanced with NLP
    titleFormat = titleFormat.replace(/\b\d+%\b/g, '{{discount}}%');

    const templateData = {
      name: templateName,
      description: templateDescription || 'Personal campaign template',
      category: campaignData.category || 'custom',
      template_type: 'personal',
      merchant_id: merchantId,
      title_format: titleFormat,
      suggested_discount: parseFloat(campaignData.deal_offer) || 25,
      discount_min: Math.max(10, parseFloat(campaignData.deal_offer) - 5) || 20,
      discount_max: Math.min(50, parseFloat(campaignData.deal_offer) + 5) || 30,
      launch_day_of_week: launchDate ? launchDate.getDay() : 5,
      launch_hour: launchDate ? launchDate.getHours() : 18,
      duration_days: duration,
      tips: JSON.stringify([
        `Based on your successful campaign`,
        `${campaignData.deal_offer}% discount worked well`,
        `Campaign duration: ${duration} days`,
      ]),
      success_rate: 0, // Will be updated based on usage
      avg_redemptions: 0,
      times_used: 0,
    };

    const { data: template, error } = await supabase
      .from('campaign_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) { console.error('[SaveCampaignTemplate] Insert failed:', error.message); throw error; }
    console.log('[SaveCampaignTemplate] Saved template:', template.id);

    return new Response(
      JSON.stringify({
        success: true,
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
        },
        message: 'Template saved successfully!',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[save-campaign-template] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
