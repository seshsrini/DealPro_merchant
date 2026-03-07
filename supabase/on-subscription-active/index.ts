if (req.method === 'OPTIONS') {

return new Response('ok', { headers: corsHeaders });

}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. GLOBAL CORS HEADERS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Validation Helpers
export const isString = (value: any): value is string => typeof value === 'string';
export const isValidPhoneNumber = (phone: string): boolean => /^\+[1-9]\d{1,14}$/.test(phone);

Deno.serve(async (req) => {
  // 2. HANDLE CORS PREFLIGHT
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  // 3. SERVICE ROLE CLIENT (Bypasses RLS to verify across multiple users)
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server configuration missing.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { refereeId, refereePhoneNumber } = await req.json();
    console.log('[OnSubscriptionActive] Processing referral for:', refereePhoneNumber);

    // 4. VALIDATION
    if (!isString(refereeId) || !isValidPhoneNumber(refereePhoneNumber)) {
      return new Response(JSON.stringify({ error: 'Invalid Referee ID or Phone Number format.' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      });
    }

    // 5. MATCHING & ACTIVATION LOGIC
    // Find a matching 'sent' invite for this phone number
    const { data: invite, error: inviteError } = await supabase
      .from('merchant_invites')
      .select('*')
      .eq('invitee_phone', refereePhoneNumber)
      .eq('status', 'sent')
      .maybeSingle();

    if (inviteError) throw inviteError;

    if (!invite) {
      return new Response(JSON.stringify({ 
        message: 'No pending invite found. No referral processed.',
        success: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 6. ATOMIC UPDATES
    // Create the permanent referral record
    const { data: referral, error: referralError } = await supabase
      .from('merchant_referrals')
      .insert([{
        referrer_id: invite.referrer_id,
        referee_id: refereeId,
        referral_code_used: invite.invite_code,
        status: 'qualified',
      }])
      .select()
      .single();

    if (referralError) throw referralError;

    // Update original invite status to prevent double-claiming
    const { error: updateError } = await supabase
      .from('merchant_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ 
      message: 'Referral activated successfully.', 
      referral 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Referral Activation Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});