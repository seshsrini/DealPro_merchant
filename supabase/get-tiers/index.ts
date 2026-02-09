import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader = req.headers.get('Authorization');

  try {
    // 1. Authenticate JWT
    if (!authHeader) throw new Error('Unauthorized: No Authorization header');
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized: Invalid token');

    // 2. Role Check (Authorization)
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || userProfile?.role !== 'merchant') {
      console.error(`[get-tiers] Role check failed for user ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Merchant access required' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // 3. Fetch Tiers
    const { data, error: tiersError } = await supabaseClient
      .from('subscription_tiers')
      .select('*')
      .eq('is_active', true)
      .order('subscription_fee', { ascending: true });

    if (tiersError) throw tiersError;

    return new Response(JSON.stringify(data || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[get-tiers EF] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: error.message?.includes('Unauthorized') ? 401 : 500 
      }
    );
  }
});