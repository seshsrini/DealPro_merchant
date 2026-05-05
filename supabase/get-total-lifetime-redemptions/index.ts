import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// 1. Helper for validation
export const isString = (value: any): boolean => typeof value === 'string';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  // 2. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 3. Authenticate the User
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!jwt) throw new Error('Unauthorized: No access token provided.');

    // Use a temporary client to verify the user identity via JWT
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !user) {
      const reason = /jwt expired|expired/i.test(authError?.message || '') ? 'expired' : 'invalid';
      throw new Error(`Unauthorized: token ${reason}`);
    }

    // 4. Parse & Validate Body
    const { merchantId } = await req.json();
    if (!isString(merchantId) || merchantId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: Access denied.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 403 
      });
    }

    // 5. Database Query using SERVICE_ROLE_KEY
    // This ensures we get the true count regardless of RLS settings on campaign_interactions
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { count, error: dbError } = await adminClient
      .from('campaign_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      // Usually redemptions are filtered by a column like is_redeemed or status
      // If you need only successful redemptions, add: .eq('is_redeemed', true)
      .eq('is_redeemed', true); 

    if (dbError) throw dbError;

    // 6. SUCCESS RESPONSE
    // Returning { count: X } to match mDashboardService.ts
    console.log(`[EF] Redemptions for ${merchantId}: ${count}`);
    return new Response(JSON.stringify({ count: count || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    const isAuth = error?.message?.includes('Unauthorized');
    if (isAuth) {
      console.warn('[EF get-total-lifetime-redemptions] Auth rejected:', error.message);
    } else {
      console.error('[EF get-total-lifetime-redemptions] Error:', error.message);
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: isAuth ? 401 : 400,
    });
  }
});