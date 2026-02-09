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
  // Fix: Explicitly declare regex type to prevent potential type inference issues.
  const regex: RegExp = /^\+?[1-9]\d{1,14}(?:[-\s]\d+)*$/;
  return regex.test(phone);
};

const isString = (value: any): boolean => typeof value === 'string';

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

    const { phone, token } = await req.json();

    if (!phone || !isValidPhoneNumber(phone)) {
      return new Response(JSON.stringify({ error: 'Valid phone number is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!token || !isString(token) || token.length !== 6 || !/^\d{6}$/.test(token)) {
      return new Response(JSON.stringify({ error: 'Valid 6-digit OTP token is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Verify the OTP. This will confirm the user's phone in auth.users
    // and potentially create a session if the user isn't already logged in.
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: 'sms',
    });

    if (error) {
      console.error('Verify OTP Failed:', error.message);
      return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    if (!data.user || !data.session) {
      return new Response(JSON.stringify({ error: 'OTP verified, but user or session data is missing.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    return new Response(JSON.stringify({ message: 'Phone number verified successfully.', userId: data.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('Verify OTP Edge Function Crash:', err.message);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});