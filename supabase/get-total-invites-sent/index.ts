import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const isString = (value: any): boolean => typeof value === 'string';

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight (Critical to avoid "Failed to send request")
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 2. Authenticate the User Identity using the incoming JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!jwt) throw new Error('Unauthorized: No token provided');

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !user) throw new Error('Unauthorized: Invalid token');

    // 3. Parse & Validate Request Body
    const { merchantId } = await req.json();
    if (!isString(merchantId) || merchantId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: Access denied' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 4. Query using SERVICE_ROLE_KEY to bypass RLS
    // This solves the issue where data exists in the table but returns 0 to the user
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { count, error: dbError } = await adminClient
      .from('merchant_invites')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', merchantId);

    if (dbError) {
      console.error(`[EF get-total-invites-sent] DB Error:`, dbError.message);
      throw dbError;
    }

    // 5. Success Response
    // Standardized key name 'count' for mDashboardService.ts
    console.log(`[EF] Invites Sent for ${merchantId}: ${count}`);
    return new Response(JSON.stringify({ count: count || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[EF get-total-invites-sent] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});