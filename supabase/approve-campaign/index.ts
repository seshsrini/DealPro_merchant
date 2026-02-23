// @ts-ignore: Deno global
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // 1. Immediate CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(">>> Function Started: approve-campaign <<<");

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // 2. Parse Body with Error Handling
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("JSON Parse Error:", e);
      return new Response(JSON.stringify({ error: "Malformed JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { campaign_id, ...updates } = body;
    console.log(`Target Campaign: ${campaign_id}`);

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Authenticate User Manually (since JWT verify is disabled)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
       console.error("Missing Authorization Header");
       return new Response(JSON.stringify({ error: "Unauthorized: Missing Header" }), {
         status: 401,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
    }

    // Initialize client with user's token to check their identity
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error("Auth Error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid Token" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Check Role in merchant_profiles (dealadmin is a merchant-app role)
    const { data: profile, error: profileError } = await userClient
      .from('merchant_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || (profile?.role !== 'dealadmin')) { // Only dealadmin can use this
      console.error(`Permission Denied for role: ${profile?.role}. Only 'dealadmin' can approve campaigns.`);
      return new Response(JSON.stringify({ error: "Forbidden: Insufficient Permissions. Only dealadmins can approve campaigns." }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Execute Update using Admin Client (Bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Explicitly casting the status to the DB Enum if necessary, 
    // and updating both timestamp columns in your schema.
    const { data, error: updateError } = await adminClient
      .from('campaigns')
      .update({
        ...updates,
        last_modified: new Date().toISOString(),
        modified_at: new Date().toISOString()
      })
      .eq('campaign_id', campaign_id)
      .select()
      .single();

    if (updateError) {
      console.error("Database Error:", updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Update Successful");
    return new Response(JSON.stringify({ success: true, campaign: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error("Global Catch Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});