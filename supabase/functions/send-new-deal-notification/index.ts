/**
 * Supabase Edge Function: Send New Deal Notification
 *
 * Triggers when a new row is added to the campaigns/deals table
 * Sends push notifications to all relevant users via Firebase Cloud Messaging (FCM)
 *
 * Deploy: supabase functions deploy send-new-deal-notification
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Firebase Admin SDK initialization (using service account)
// You'll need to set these environment variables in Supabase Dashboard
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n') || '';

interface Deal {
  campaign_id: string;
  deal_heading: string;
  shop_name: string;
  city: string;
  category: string;
  offer_value: string;
  image_url?: string;
}

interface FCMToken {
  device_token: string;
  user_id: string;
}

/**
 * Get Firebase access token using service account credentials
 */
async function getFirebaseAccessToken(): Promise<string> {
  try {
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: FIREBASE_CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    // Create JWT (you might need to use a JWT library for proper signing)
    // For now, this is a simplified version - in production, use proper JWT signing
    const encoder = new TextEncoder();
    const data = encoder.encode(
      JSON.stringify(header) + '.' + JSON.stringify(payload)
    );

    // Import private key
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = FIREBASE_PRIVATE_KEY.replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, data);

    // Base64 encode signature
    const base64Signature = btoa(
      String.fromCharCode(...new Uint8Array(signature))
    );

    const jwt = `${btoa(JSON.stringify(header))}.${btoa(
      JSON.stringify(payload)
    )}.${base64Signature}`;

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const data2 = await response.json();
    return data2.access_token;
  } catch (error) {
    console.error('[FCM] Error getting access token:', error);
    throw error;
  }
}

/**
 * Send FCM notification using Firebase HTTP v1 API
 */
async function sendFCMNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
): Promise<boolean> {
  try {
    const accessToken = await getFirebaseAccessToken();

    const message = {
      message: {
        token: token,
        notification: {
          title: title,
          body: body,
        },
        data: data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[FCM] Send error:', error);
      return false;
    }

    const result = await response.json();
    console.log('[FCM] Notification sent successfully:', result);
    return true;
  } catch (error) {
    console.error('[FCM] Error sending notification:', error);
    return false;
  }
}

/**
 * Main handler
 */
serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const payload = await req.json();
    console.log('[Webhook] Received payload:', payload);

    // Extract the new deal data
    const deal: Deal = payload.record || payload.new;
    if (!deal) {
      console.error('[Webhook] No deal data in payload');
      return new Response(JSON.stringify({ error: 'No deal data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[Webhook] Campaign updated:', {
      id: deal.campaign_id,
      heading: deal.deal_heading,
      shop: deal.shop_name,
      merchant_id: deal.merchant_id,
      status: deal.status,
    });

    // CRITICAL: Only send notifications if campaign status is 'active'
    // This prevents notifications for draft edits or pending campaigns
    if (deal.status !== 'active') {
      console.log(`[FCM] Campaign status is '${deal.status}', not 'active'. Skipping notification.`);
      return new Response(
        JSON.stringify({ message: 'Campaign not active, no notification sent', status: deal.status }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[FCM] Campaign is active, proceeding with notification...');

    // IMPORTANT: Only notify users who have favorited this merchant
    // Step 1: Find users who favorited this merchant
    const { data: favoritedUsers, error: favoritesError } = await supabase
      .from('favorites')
      .select('user_id')
      .eq('merchant_id', deal.merchant_id);

    if (favoritesError) {
      console.error('[Database] Error fetching favorites:', favoritesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch favorites' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!favoritedUsers || favoritedUsers.length === 0) {
      console.log('[FCM] No users have favorited this merchant. No notifications to send.');
      return new Response(
        JSON.stringify({ message: 'No users to notify', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract user IDs who favorited this merchant
    const favoritedUserIds = favoritedUsers.map(f => f.user_id);
    console.log(`[FCM] Found ${favoritedUserIds.length} users who favorited this merchant`);

    // Step 2: Get FCM tokens for those users (who are also consumers)
    const { data: tokens, error: tokensError } = await supabase
      .from('fcm_tokens')
      .select(`
        device_token,
        user_id,
        user_profiles!inner(role)
      `)
      .eq('is_active', true)
      .eq('user_profiles.role', 'consumer')
      .in('user_id', favoritedUserIds);

    if (tokensError) {
      console.error('[Database] Error fetching tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tokens' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('[FCM] No active tokens found');
      return new Response(
        JSON.stringify({ message: 'No users to notify', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FCM] Found ${tokens.length} active tokens`);

    // Prepare notification content
    const notificationTitle = '🎉 New Deal Live!';
    const notificationBody = `${deal.offer_value} at ${deal.shop_name} in ${deal.city}`;
    const notificationData = {
      campaign_id: deal.campaign_id,
      type: 'new_deal',
      city: deal.city,
      category: deal.category,
      screen: 'CampaignDetails', // Deep link to campaign details screen
    };

    // Send notifications to all tokens
    const results = await Promise.allSettled(
      tokens.map((tokenData: FCMToken) =>
        sendFCMNotification(
          tokenData.device_token,
          notificationTitle,
          notificationBody,
          notificationData
        )
      )
    );

    // Count successes and failures
    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    const failureCount = results.length - successCount;

    // Update last_used_at for successfully sent tokens
    if (successCount > 0) {
      const successTokens = tokens
        .filter((_, index) => results[index].status === 'fulfilled')
        .map((t) => t.device_token);

      await supabase
        .from('fcm_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .in('device_token', successTokens);
    }

    console.log(`[FCM] Notifications sent: ${successCount} success, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Notifications sent',
        total: tokens.length,
        sent: successCount,
        failed: failureCount,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Error]', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * SETUP INSTRUCTIONS:
 *
 * 1. Install Firebase Admin SDK in your Firebase project
 * 2. Generate a service account key from Firebase Console
 * 3. Set environment variables in Supabase Dashboard:
 *    - FIREBASE_PROJECT_ID: Your Firebase project ID
 *    - FIREBASE_CLIENT_EMAIL: Service account email
 *    - FIREBASE_PRIVATE_KEY: Private key from service account JSON
 *
 * 4. Deploy this function:
 *    supabase functions deploy send-new-deal-notification
 *
 * 5. Create a Database Webhook in Supabase Dashboard:
 *    - Table: campaigns (or deals)
 *    - Events: INSERT
 *    - Type: supabase_function
 *    - Function: send-new-deal-notification
 *
 * 6. Test by inserting a new campaign/deal in your database
 *
 * ALTERNATIVE: You can also call this function directly via HTTP:
 * POST https://your-project.supabase.co/functions/v1/send-new-deal-notification
 * Headers: { "Authorization": "Bearer YOUR_ANON_KEY" }
 * Body: { "record": { ...deal data... } }
 */
