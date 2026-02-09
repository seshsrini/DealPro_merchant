import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight (Prevents "Failed to send request")
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 2. Authenticate the User
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!jwt) throw new Error('No token provided');

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(jwt);
    if (authError || !user) throw new Error('Unauthorized');

    // 3. Parse Request
    const { merchantId } = await req.json();
    if (merchantId !== user.id) throw new Error('Forbidden: ID mismatch');

    // 4. Database Query
    // Using head: true for maximum efficiency on count-only queries
    const { count, error: dbError } = await adminClient
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchantId);

    if (dbError) throw dbError;

    // 5. SUCCESS RESPONSE (Matches your mDashboardService.ts expectation)
    return new Response(JSON.stringify({ count: count || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[EF get-total-lifetime-deals] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});