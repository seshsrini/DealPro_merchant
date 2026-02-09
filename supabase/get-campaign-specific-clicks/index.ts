import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 2. Setup Supabase Client with User's JWT
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 3. Verify User
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    // 4. Parse Body (expecting campaignIds)
    const { campaignIds } = await req.json();

    if (!Array.isArray(campaignIds)) {
       return new Response(JSON.stringify({ error: 'campaignIds must be an array' }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 400,
       });
    }

    // 5. Query Click Logs
    const { data: clickLogs, error: dbError } = await supabase
      .from('user_activity_logs')
      .select('campaign_id')
      .eq('event_type', 'click')
      .in('campaign_id', campaignIds);

    if (dbError) throw dbError;

    // 6. Aggregate Counts
    const counts: Record<string, number> = {};
    campaignIds.forEach(id => counts[id] = 0);
    clickLogs?.forEach(log => {
      if (log.campaign_id) counts[log.campaign_id]++;
    });

    return new Response(JSON.stringify(counts), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});