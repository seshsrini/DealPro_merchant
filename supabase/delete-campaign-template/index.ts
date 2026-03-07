/**
 * delete-campaign-template Edge Function
 * Deletes a personal template (system templates cannot be deleted)
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

    const { templateId, merchantId } = await req.json();
    console.log('[DeleteCampaignTemplate] Deleting template:', templateId, 'for merchant:', merchantId);

    if (!templateId || !merchantId) {
      return new Response(
        JSON.stringify({ error: 'templateId and merchantId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if template belongs to merchant and is personal
    const { data: template, error: fetchError } = await supabase
      .from('campaign_templates')
      .select('id, template_type, merchant_id')
      .eq('id', templateId)
      .single();

    if (fetchError) throw fetchError;

    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (template.template_type === 'system') {
      return new Response(
        JSON.stringify({ error: 'System templates cannot be deleted' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (template.merchant_id !== merchantId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Template does not belong to this merchant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the template
    const { error: deleteError } = await supabase
      .from('campaign_templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) { console.error('[DeleteCampaignTemplate] Delete failed:', deleteError.message); throw deleteError; }
    console.log('[DeleteCampaignTemplate] Successfully deleted template:', templateId);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Template deleted successfully',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[delete-campaign-template] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
