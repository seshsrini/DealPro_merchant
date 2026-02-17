/**
 * Supabase Edge Function: Manage FCM Tokens
 * Handles FCM token registration/unregistration with service role key (bypasses RLS)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body
    const { action, userId, deviceToken, deviceType, deviceName, appVersion } = await req.json();

    console.log(`[ManageFCMTokens] Action: ${action}, User: ${userId}`);

    // Validation: Every action needs a userId
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'register': {
        // Register or update FCM token
        if (!deviceToken) {
          return new Response(
            JSON.stringify({ success: false, error: 'deviceToken is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[ManageFCMTokens] Registering token for user:', userId);

        const { data, error } = await supabase
          .from('fcm_tokens')
          .upsert(
            {
              user_id: userId,
              device_token: deviceToken,
              device_type: deviceType || 'android',
              device_name: deviceName || null,
              app_version: appVersion || '1.0.0',
              is_active: true,
              last_used_at: new Date().toISOString(),
            },
            {
              onConflict: 'device_token',
              ignoreDuplicates: false,
            }
          )
          .select()
          .single();

        if (error) {
          console.error('[ManageFCMTokens] Error registering token:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[ManageFCMTokens] Token registered successfully:', data.id);
        return new Response(
          JSON.stringify({ success: true, tokenId: data.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'unregister': {
        // Mark token as inactive (don't delete, for audit trail)
        if (!deviceToken) {
          return new Response(
            JSON.stringify({ success: false, error: 'deviceToken is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[ManageFCMTokens] Unregistering token for user:', userId);

        const { error } = await supabase
          .from('fcm_tokens')
          .update({ is_active: false })
          .eq('user_id', userId)
          .eq('device_token', deviceToken);

        if (error) {
          console.error('[ManageFCMTokens] Error unregistering token:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[ManageFCMTokens] Token unregistered successfully');
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        // Get all active tokens for a user
        console.log('[ManageFCMTokens] Fetching tokens for user:', userId);

        const { data, error } = await supabase
          .from('fcm_tokens')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[ManageFCMTokens] Error fetching tokens:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[ManageFCMTokens] Found', data?.length || 0, 'active tokens');
        return new Response(
          JSON.stringify({ success: true, tokens: data || [], count: data?.length || 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('[ManageFCMTokens] Exception:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
