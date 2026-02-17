// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined; };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- HELPER FUNCTIONS ---

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function applyRateLimit(req: Request): { allowed: boolean; response?: Response } {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const limit = 10; // 10 login attempts per minute
  const window = 60000;

  const record = rateLimitMap.get(ip);
  if (record && now < record.resetTime) {
    if (record.count >= limit) {
      return {
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too many login attempts. Please try again later.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
      };
    }
    record.count++;
  } else {
    rateLimitMap.set(ip, { count: 1, resetTime: now + window });
  }
  return { allowed: true };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- MAIN HANDLER ---

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const rateLimit = applyRateLimit(req);
  if (!rateLimit.allowed) return rateLimit.response!;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const adminClient = createClient(supabaseUrl, serviceKey);
    const supabaseAuth = createClient(supabaseUrl, anonKey);

    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return new Response(JSON.stringify({ error: 'Identifier and password required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log('[Login] Login attempt for:', identifier);

    const normalizedIdentifier = identifier.trim().toLowerCase();

    // Normalize phone number: if it's 10 digits starting with 6-9, add +91 prefix
    let phoneIdentifier = identifier;
    const cleanPhone = identifier.replace(/\D/g, '');
    if (cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)) {
      phoneIdentifier = `+91${cleanPhone}`;
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      phoneIdentifier = `+${cleanPhone}`;
    }

    // Find user in user_profiles (must have email for auth)
    const { data: userProfile, error: profileLookupError } = await adminClient
      .from('user_profiles')
      .select('id, email, phone, role')
      .or(`username.ilike.${normalizedIdentifier},email.ilike.${normalizedIdentifier},phone.eq.${phoneIdentifier}`)
      .maybeSingle();

    if (profileLookupError) {
      console.error('[Login] Profile lookup error:', profileLookupError);
      return new Response(JSON.stringify({ error: 'User lookup failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    if (!userProfile) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    if (!userProfile.email) {
      console.error('[Login] User has no email:', userProfile.id);
      return new Response(JSON.stringify({ error: 'Invalid user configuration' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log('[Login] User found:', { id: userProfile.id, role: userProfile.role, email: userProfile.email });

    // Authenticate with email + password
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: userProfile.email,
      password: password,
    });

    if (authError) {
      console.error('[Login] Auth error:', authError.message);
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    if (!authData.user || !authData.session) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log('[Login] Auth successful for:', userProfile.id);

    // Fetch full profile
    const { data: fullProfile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !fullProfile) {
      console.error('[Login] Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    // Update first_login_at if needed
    if (!fullProfile.first_login_at) {
      await adminClient
        .from('user_profiles')
        .update({ first_login_at: new Date().toISOString() })
        .eq('id', authData.user.id);

      fullProfile.first_login_at = new Date().toISOString();
      console.log('[Login] Set first_login_at for:', authData.user.id);
    }

    return new Response(JSON.stringify({
      user: fullProfile,
      session: authData.session,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[Login] Error:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
