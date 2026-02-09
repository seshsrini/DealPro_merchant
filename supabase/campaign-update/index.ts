import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); // Check if this exists
    const authHeader = req.headers.get('Authorization')!;

    if (!supabaseServiceKey) {
       throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY secret.");
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Get User and Profile
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: profile } = await userClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'dealAdmin';
    const isMerchant = profile?.role === 'merchant';

    if (!isAdmin && !isMerchant) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient Role' }), { status: 403, headers: corsHeaders });
    }

    // 2. Parse Body
    const body = await req.json();
    const { campaign_id, ...updates } = body;

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: 'campaign_id is required' }), { status: 400, headers: corsHeaders });
    }

    // 3. Security Check for Merchants
    if (isMerchant && !isAdmin) {
      const { data: campaign } = await userClient
        .from('campaigns')
        .select('merchant_id')
        .eq('campaign_id', campaign_id)
        .single();
      
      if (campaign?.merchant_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Forbidden: Ownership mismatch' }), { status: 403, headers: corsHeaders });
      }
    }

    // 4. Clean Payload for your Schema
    // Ensuring we only update fields that exist and handling modified_at
    const cleanPayload = {
      ...updates,
      modified_at: new Date().toISOString(),
      last_modified: new Date().toISOString()
    };

    // 5. Execute with Service Role (Bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error: updateError } = await adminClient
      .from('campaigns')
      .update(cleanPayload)
      .eq('campaign_id', campaign_id)
      .select()
      .single();

    if (updateError) {
      console.error("Database Update Error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, campaign: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Edge Function Exception:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});