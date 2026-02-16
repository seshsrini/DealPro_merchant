/**
 * Supabase Edge Function: Manage Pinned Deals
 * Handles pin/unpin operations with corrected validation and schema mapping
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body
    const { action, userId, campaignId, merchantId } = await req.json();

    console.log(`[ManagePinnedDeals] Action: ${action}, User: ${userId}, Campaign: ${campaignId}`);

    // 2. Validation: Every action needs a userId
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Conditional Validation: list action does NOT need campaignId
    const needsCampaign = ['pin', 'unpin', 'check', 'toggle'].includes(action);
    if (needsCampaign && !campaignId) {
      return new Response(
        JSON.stringify({ success: false, error: `campaignId required for ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'list': {
        // Fetch pins using the explicit foreign key relationship
        const { data, error } = await supabase
          .from('pinned_deals')
          .select(`
            id,
            campaign_id,
            merchant_id,
            created_at,
            active_status,
            campaigns (
              deal_heading,
              offer_value,
              shop_name,
              category,
              image_url,
              status
            )
          `)
          .eq('user_id', userId)
          .eq('active_status', true)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, pins: data || [], count: data?.length || 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'pin': {
        if (!merchantId) throw new Error('merchantId required for pinning');
        
        const { data, error } = await supabase
          .from('pinned_deals')
          .upsert({
            user_id: userId,
            campaign_id: campaignId,
            merchant_id: merchantId,
            active_status: true
          }, { onConflict: 'user_id, campaign_id' })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, isPinned: true, data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'unpin': {
        const { error } = await supabase
          .from('pinned_deals')
          .delete()
          .eq('user_id', userId)
          .eq('campaign_id', campaignId);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, isPinned: false }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'check': {
        const { data, error } = await supabase
          .from('pinned_deals')
          .select('id')
          .eq('user_id', userId)
          .eq('campaign_id', campaignId)
          .maybeSingle();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, isPinned: !!data }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'toggle': {
        if (!merchantId) throw new Error('merchantId required for toggling');

        // First check if it's currently pinned
        const { data: existingPin, error: checkError } = await supabase
          .from('pinned_deals')
          .select('id')
          .eq('user_id', userId)
          .eq('campaign_id', campaignId)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existingPin) {
          // Already pinned, so unpin it
          const { error: deleteError } = await supabase
            .from('pinned_deals')
            .delete()
            .eq('user_id', userId)
            .eq('campaign_id', campaignId);

          if (deleteError) throw deleteError;
          return new Response(JSON.stringify({ success: true, isPinned: false }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          // Not pinned, so pin it
          const { data: newPin, error: insertError } = await supabase
            .from('pinned_deals')
            .upsert({
              user_id: userId,
              campaign_id: campaignId,
              merchant_id: merchantId,
              active_status: true
            }, { onConflict: 'user_id, campaign_id' })
            .select()
            .single();

          if (insertError) throw insertError;
          return new Response(JSON.stringify({ success: true, isPinned: true, data: newPin }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error('[ManagePinnedDeals] Exception:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});