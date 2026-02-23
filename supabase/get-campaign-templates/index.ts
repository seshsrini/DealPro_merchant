/**
 * get-campaign-templates Edge Function
 * Fetches all available campaign templates (system + merchant's personal)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  templateType: 'system' | 'personal';
  titleFormat: string;
  suggestedDiscount: number;
  discountMin: number;
  discountMax: number;
  launchDayOfWeek: number;
  launchHour: number;
  durationDays: number;
  tips: string[];
  successRate: number;
  avgRedemptions: number;
  timesUsed: number;
  lastUsedAt: string | null;
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

    // Fetch system templates + merchant's personal templates
    const { data: templates, error } = await supabase
      .from('campaign_templates')
      .select('*')
      .or(`template_type.eq.system,and(template_type.eq.personal,merchant_id.eq.${merchantId})`)
      .eq('is_active', true)
      .order('template_type', { ascending: false }) // System first
      .order('success_rate', { ascending: false }); // Then by success rate

    if (error) throw error;

    // Transform to camelCase
    const formattedTemplates: CampaignTemplate[] = (templates || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      templateType: t.template_type,
      titleFormat: t.title_format,
      suggestedDiscount: parseFloat(t.suggested_discount) || 0,
      discountMin: parseFloat(t.discount_min) || 0,
      discountMax: parseFloat(t.discount_max) || 0,
      launchDayOfWeek: t.launch_day_of_week,
      launchHour: t.launch_hour,
      durationDays: t.duration_days,
      tips: t.tips || [],
      successRate: parseFloat(t.success_rate) || 0,
      avgRedemptions: t.avg_redemptions || 0,
      timesUsed: t.times_used || 0,
      lastUsedAt: t.last_used_at,
    }));

    // Group by category
    const grouped: Record<string, CampaignTemplate[]> = {
      'flash-sale': [],
      'festival': [],
      'clearance': [],
      'new-launch': [],
      'premium': [],
      'custom': [],
      'personal': [],
    };

    formattedTemplates.forEach((template) => {
      if (template.templateType === 'personal') {
        grouped.personal.push(template);
      } else if (grouped[template.category]) {
        grouped[template.category].push(template);
      } else {
        grouped.custom.push(template);
      }
    });

    return new Response(
      JSON.stringify({
        templates: formattedTemplates,
        grouped,
        totalCount: formattedTemplates.length,
        systemCount: formattedTemplates.filter(t => t.templateType === 'system').length,
        personalCount: formattedTemplates.filter(t => t.templateType === 'personal').length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-campaign-templates] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
