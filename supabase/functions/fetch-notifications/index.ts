/**
 * Supabase Edge Function: Fetch Notifications
 * Handles fetching unread notifications and marking them as read for consumers.
 *
 * Actions:
 * fetch     - Get unread/null notifications
 * count     - Get count of unread/null notifications
 * mark-read - Update unread/null notifications to is_read = true
 *
 * Deploy: supabase functions deploy fetch-notifications
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // 1. Handle Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Robust JSON Body Parsing
    const bodyText = await req.text();
    if (!bodyText) {
      return new Response(
        JSON.stringify({ success: false, error: 'Request body is empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, userId } = payload;

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[NotificationAction] Action: ${action} | User: ${userId}`);

    switch (action) {
      case 'fetch': {
        const { data, error } = await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', userId)
          // Fetch notifications that are NOT explicitly read
          .neq('is_read', true)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, notifications: data ?? [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'count': {
        const { count, error } = await supabase
          .from('user_notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .neq('is_read', true);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, count: count ?? 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'mark-read': {
        const { data, error } = await supabase
          .from('user_notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .neq('is_read', true)
          .select();

        if (error) throw error;

        const updatedCount = data?.length || 0;
        console.log(`[MarkRead] Successfully updated ${updatedCount} notifications.`);

        return new Response(
          JSON.stringify({ success: true, updatedCount }),
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
    console.error('[FetchNotifications] Global Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
