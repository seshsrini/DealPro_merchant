import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Environment variables provided by Supabase automatically in production
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Server configuration missing: SUPABASE_URL or SERVICE_KEY")
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // SECURITY: deployed with --no-verify-jwt, so the gateway does NOT
    // authenticate the caller. Verify the JWT here and derive the referrer from
    // the VERIFIED token — never from a body-supplied referrerId (which let
    // anyone forge invite rows crediting any merchant). The app calls this via
    // supabase.functions.invoke while logged in, so the session token is always
    // attached and user.id already equals the referrerId it sends — behaviour is
    // unchanged for real callers; only anonymous/forged calls are rejected.
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token)
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // 2. Parse the body
    const body = await req.json()
    console.log("Processing invite request for referrer:", user.id)

    const { referralCode, inviteePhoneNumber } = body

    // 3. Database Insertion — referrer_id is the VERIFIED caller, not a body value.
    const { data, error: dbError } = await supabaseClient
      .from('merchant_invites')
      .insert([
        {
          referrer_id: user.id,
          invite_code: referralCode,
          invitee_phone: inviteePhoneNumber || 'Not Provided', // Ensure NOT NULL constraint is met
          status: 'sent'
        }
      ])
      .select()

    if (dbError) {
      console.error("Database Error:", dbError.message)
      throw dbError
    }

    // 4. Success Response
    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error) {
    console.error("Function Execution Error:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    )
  }
})