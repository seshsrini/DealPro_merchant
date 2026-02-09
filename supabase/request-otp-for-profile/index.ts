
// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const isValidPhoneNumber = (phone: string): boolean => {
  const regex = /^\+?[1-9]\d{1,14}(?:[-\s]\d+)*$/;
  return regex.test(phone);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, anonKey);

    const { phone } = await req.json();
    console.log(`[request-otp-for-profile EF] Received phone number for OTP: ${phone}`); // Added logging

    if (!phone || !isValidPhoneNumber(phone)) {
      return new Response(JSON.stringify({ error: 'Valid phone number is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Use signInWithOtp to send the OTP.
    // shouldCreateUser: true will create an unconfirmed user if the phone doesn't exist.
    // This allows verification for new numbers without needing a prior signup.
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phone,
      options: {
        channel: 'sms',
        shouldCreateUser: true, 
      },
    });

    if (error) {
      console.error('Request OTP Failed:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    return new Response(JSON.stringify({ message: 'OTP sent successfully to ' + phone }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('Request OTP Edge Function Crash:', err.message);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
