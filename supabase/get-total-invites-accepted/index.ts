import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Helper
const isString = (value: any): boolean => typeof value === 'string';

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 2. Authenticate the User Identity
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!jwt) throw new Error('Unauthorized: No access token provided.');

    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !user) {
      const reason = /jwt expired|expired/i.test(authError?.message || '') ? 'expired' : 'invalid';
      throw new Error(`Unauthorized: token ${reason}`);
    }

    // 3. Validate Request Body
    const { merchantId } = await req.json();
    if (!isString(merchantId) || merchantId !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: Access denied' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 4. Database Query using SERVICE_ROLE_KEY
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { count, error: dbError } = await adminClient
      .from('merchant_referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', merchantId)
      .eq('status', 'qualified'); // Ensure this matches your logic for 'accepted'

    if (dbError) throw dbError;

    // 5. Success Response
    console.log(`[EF] Invites Accepted for ${merchantId}: ${count}`);
    return new Response(JSON.stringify({ count: count || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    const isAuth = error?.message?.includes('Unauthorized');
    if (isAuth) {
      console.warn('[EF get-total-invites-accepted] Auth rejected:', error.message);
    } else {
      console.error('[EF get-total-invites-accepted] Error:', error.message);
    }
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: isAuth ? 401 : 400,
    });
  }
});