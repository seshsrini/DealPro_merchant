import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Reuse your validation helpers...
const isString = (val: any) => typeof val === 'string';
const isValidUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 1. Authenticate Request
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // 2. Role Check (Case Insensitive)
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Use toLowerCase() to avoid 'dealAdmin' vs 'dealadmin' issues
    if (!profile || profile.role?.toLowerCase() !== 'dealadmin') {
      console.error(`User ${user.id} denied. Role: ${profile?.role}`);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access only' }), { status: 403, headers: corsHeaders });
    }

    // 3. Robust Body Parsing
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders });
    }

    const { campaign_id, ...updates } = body;

    if (!campaign_id || !isValidUUID(campaign_id)) {
      return new Response(JSON.stringify({ error: 'Valid Campaign ID is required' }), { status: 400, headers: corsHeaders });
    }

    // 4. Update Database
    // We update only what's provided in the body to allow partial updates (like just the status)
    const { data, error: updateError } = await adminSupabase
      .from('campaigns')
      .update({
        ...updates,
        modified_at: new Date().toISOString(),
        last_modified: new Date().toISOString()
      })
      .eq('campaign_id', campaign_id)
      .select()
      .single();

    if (updateError) {
      console.error('Update Error:', updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ message: 'Updated', campaign: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Global Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});