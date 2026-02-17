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
import { create } from 'https://deno.land/x/djwt@v3.0.1/mod.ts';

// Firebase Admin SDK initialization (using service account)
// You'll need to set these environment variables in Supabase Dashboard
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') || '';
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL') || '';
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n') || '';

// Debug: Check if credentials are loaded
console.log('[DEBUG] Firebase credentials check:');
console.log('[DEBUG] PROJECT_ID:', FIREBASE_PROJECT_ID ? 'SET' : 'MISSING');
console.log('[DEBUG] CLIENT_EMAIL:', FIREBASE_CLIENT_EMAIL ? 'SET' : 'MISSING');
console.log('[DEBUG] PRIVATE_KEY length:', FIREBASE_PRIVATE_KEY ? FIREBASE_PRIVATE_KEY.length : 'MISSING');
console.log('[DEBUG] PRIVATE_KEY starts with:', FIREBASE_PRIVATE_KEY ? FIREBASE_PRIVATE_KEY.substring(0, 27) : 'N/A');

interface Deal {
  campaign_id: string;
  deal_heading: string;
  shop_name: string;
  store_id?: string; // Reference to merchant_stores table
  locality?: string;
  city?: string;
  category: string;
  offer_value: string;
  image_url?: string;
  merchant_id: string;
  status: string;
}

interface FCMToken {
  device_token: string;
  user_id: string;
}

/**
 * Get Firebase access token using djwt (Deno-native JWT library)
 */
async function getFirebaseAccessToken(): Promise<string> {
  try {
    console.log('[FCM] Creating JWT using djwt library...');

    const now = Math.floor(Date.now() / 1000);

    // JWT payload for Google OAuth2
    const payload = {
      iss: FIREBASE_CLIENT_EMAIL,
      sub: FIREBASE_CLIENT_EMAIL,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600, // 1 hour from now
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    };

    // Import the private key
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

    // Create and sign JWT using djwt
    const jwt = await create({ alg: 'RS256', typ: 'JWT' }, payload, key);

    console.log('[FCM] JWT created successfully, exchanging for access token...');

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[FCM] Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('[FCM] ✅ Access token obtained successfully');
    return tokenData.access_token;
  } catch (error) {
    console.error('[FCM] ❌ Error getting access token:', error);
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

    // Extract the new deal data (defensive extraction)
    const record = payload.record || payload.new || payload;
    if (!record) {
      console.error('[Webhook] No deal data in payload');
      return new Response(JSON.stringify({ error: 'No deal data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deal: Deal = record;

    // Extract store_id using snake_case (database column format)
    const storeId = record.store_id;

    console.log('[Webhook] Campaign updated:', {
      id: deal.campaign_id,
      heading: deal.deal_heading,
      shop: deal.shop_name,
      merchant_id: deal.merchant_id,
      status: deal.status,
      store_id: storeId,
    });

    // Debug: Log full deal object to see all available fields
    console.log('[DEBUG] Full deal object:', JSON.stringify(deal, null, 2));
    console.log('[DEBUG] Extracted storeId:', storeId);

    // Fetch store location details from merchant_stores table
    if (storeId) {
      console.log('[Database] Fetching location for store_id:', storeId);

      const { data: storeData, error: storeError } = await supabase
        .from('merchant_stores')
        .select('locality, city')
        .eq('id', storeId)
        .maybeSingle();

      if (storeError) {
        console.error('[Database] Error:', storeError.message);
      } else if (storeData) {
        // Populate location fields from merchant_stores
        deal.locality = storeData.locality;
        deal.city = storeData.city;
        console.log(`[Success] Location found: ${deal.locality}, ${deal.city}`);
      } else {
        console.warn('[Database] No matching store found for ID:', storeId);
      }
    } else {
      console.warn('[Database] No store_id in campaign, cannot fetch location');
    }

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

    // LOCALITY-BASED: Notify all consumers in the merchant's store locality
    // Step 1: Match consumers by home_location against merchant store locality
    const storeLocality = deal.locality;
    const storeCity = deal.city;

    if (!storeLocality && !storeCity) {
      console.log('[FCM] No store location available, cannot match consumers by locality.');
      return new Response(
        JSON.stringify({ message: 'No store location data, no notifications sent', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let localConsumerIds: string[] = [];

    // Primary match: consumers whose home_location contains the store's locality name
    if (storeLocality) {
      console.log(`[FCM] Searching consumers with home_location matching locality: '${storeLocality}'`);
      const { data: localityUsers, error: localityError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'consumer')
        .ilike('home_location', `%${storeLocality}%`);

      if (localityError) {
        console.error('[Database] Error finding consumers by locality:', localityError);
      } else if (localityUsers && localityUsers.length > 0) {
        localConsumerIds = localityUsers.map((u: { id: string }) => u.id);
        console.log(`[FCM] Found ${localConsumerIds.length} consumers in locality '${storeLocality}'`);
      }
    }

    // Fallback: if no locality match, try city-level match
    if (localConsumerIds.length === 0 && storeCity) {
      console.log(`[FCM] No locality match found, falling back to city: '${storeCity}'`);
      const { data: cityUsers, error: cityError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'consumer')
        .ilike('home_location', `%${storeCity}%`);

      if (cityError) {
        console.error('[Database] Error finding consumers by city:', cityError);
      } else if (cityUsers && cityUsers.length > 0) {
        localConsumerIds = cityUsers.map((u: { id: string }) => u.id);
        console.log(`[FCM] Found ${localConsumerIds.length} consumers in city '${storeCity}'`);
      }
    }

    if (localConsumerIds.length === 0) {
      console.log('[FCM] No consumers found in this locality/city. No notifications to send.');
      return new Response(
        JSON.stringify({ message: 'No local consumers to notify', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Get FCM tokens for consumers in this locality
    const { data: tokens, error: tokensError } = await supabase
      .from('fcm_tokens')
      .select('device_token, user_id')
      .eq('is_active', true)
      .in('user_id', localConsumerIds);

    if (tokensError) {
      console.error('[Database] Error fetching tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tokens' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('[FCM] No active FCM tokens found for consumers in this locality');
      return new Response(
        JSON.stringify({ message: 'No active device tokens for local consumers', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[FCM] Found ${tokens.length} active tokens for ${localConsumerIds.length} local consumers`);

    // Prepare notification content
    const notificationTitle = 'New Deal Live!';

    // Construct location string: "locality, city" or "city" or "locality"
    let location = '';
    if (deal.locality && deal.city) {
      location = `${deal.locality}, ${deal.city}`;
    } else if (deal.city) {
      location = deal.city;
    } else if (deal.locality) {
      location = deal.locality;
    }

    const notificationBody = location
      ? `${deal.offer_value} at ${deal.shop_name} in ${location}`
      : `${deal.offer_value} at ${deal.shop_name}`;

    const notificationData = {
      campaign_id: deal.campaign_id,
      type: 'new_deal',
      locality: deal.locality || '',
      city: deal.city || '',
      category: deal.category,
      screen: 'CampaignDetails', // Deep link to campaign details screen
    };

    // Bulk insert notification records into user_notifications for all local consumers
    const notificationRows = localConsumerIds.map((userId) => ({
      user_id: userId,
      campaign_id: deal.campaign_id,
      merchant_id: deal.merchant_id,
      type: 'new_deal',
      title: notificationTitle,
      body: notificationBody,
      image_url: deal.image_url || null,
      is_read: false,
    }));

    const { error: notifInsertError } = await supabase
      .from('user_notifications')
      .insert(notificationRows);

    if (notifInsertError) {
      console.error('[Database] Failed to insert user_notifications:', notifInsertError.message);
    } else {
      console.log(`[Database] Inserted ${notificationRows.length} notification records into user_notifications`);
    }

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
