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
  'Access-Control-Max-Age': '86400',
};

/**
 * login-merchant Edge Function
 *
 * Phone-only OTP login for merchants.
 * 1. Receives phone + country_code (phone already verified via Firebase OTP on client)
 * 2. Looks up merchant in merchant_profiles by phone
 * 3. Gets the auth user email (from auth.users table) for magic-link generation
 * 4. Generates a magic-link token via Supabase Admin API
 * 5. Returns { user, token_hash } so the client can call verifyOtp
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { phone, country_code } = body;

    if (!phone) {
      return new Response(JSON.stringify({ error: 'Phone number is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Phone field in merchant_profiles stores digits only (e.g. "9876543210")
    // Country code is in a separate country_code column (e.g. "+91")
    const cleanDigits = phone.replace(/\D/g, '');
    const cc = country_code || '+91';

    console.log('[LoginMerchant] Phone login attempt for:', cc, cleanDigits);

    // Look up merchant by phone (digits) — try multiple formats to be safe
    // DB may store as "9876543210" or "+919876543210" depending on registration flow
    let { data: merchant, error: lookupError } = await adminClient
      .from('merchant_profiles')
      .select('*')
      .or(`phone.eq.${cleanDigits},phone.eq.${cc}${cleanDigits}`)
      .maybeSingle();

    if (lookupError) {
      console.error('[LoginMerchant] Lookup error:', lookupError);
      return new Response(JSON.stringify({ error: 'Login failed. Please try again.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // If no merchant found, auto-register: create auth user + minimal merchant_profiles row.
    // The onboarding wizard will collect the remaining details (name, store, docs, etc.)
    let emailForLink: string;

    if (!merchant) {
      console.log('[LoginMerchant] No merchant found for:', cc, cleanDigits, '— auto-registering...');

      // Generate an internal email for Supabase Auth (phone-only signup)
      const internalEmail = `${cleanDigits}@merchant.dealpro.app`;
      const tempPassword = crypto.randomUUID(); // Not used for login, just required by Supabase Auth

      // Create auth user
      const { data: newAuth, error: authCreateError } = await adminClient.auth.admin.createUser({
        email: internalEmail,
        password: tempPassword,
        email_confirm: true, // Auto-confirm since phone is already verified via Firebase OTP
        user_metadata: { role: 'merchant', phone: cleanDigits },
      });

      if (authCreateError || !newAuth?.user) {
        console.error('[LoginMerchant] Auto-register auth failed:', authCreateError);
        return new Response(JSON.stringify({ error: 'Registration failed. Please try again.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      const newUserId = newAuth.user.id;

      // Create minimal merchant_profiles row — onboarding wizard will fill the rest
      const { data: newProfile, error: profileError } = await adminClient
        .from('merchant_profiles')
        .insert({
          id: newUserId,
          phone: cleanDigits,
          country_code: cc,
          role: 'merchant',
          active_status: true,
        })
        .select('*')
        .single();

      if (profileError) {
        console.error('[LoginMerchant] Auto-register profile failed:', profileError);
        // Rollback: delete the auth user we just created
        await adminClient.auth.admin.deleteUser(newUserId);
        return new Response(JSON.stringify({ error: 'Registration failed. Please try again.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      console.log('[LoginMerchant] Auto-registered new merchant:', newUserId);
      merchant = newProfile;
      emailForLink = internalEmail;
    } else {
      console.log('[LoginMerchant] Merchant found:', merchant.id);

      // Get the email for magic link generation.
      // merchant_profiles.email may be null for phone-only registrations,
      // so fall back to the auth.users table which always has the email from signup.
      emailForLink = merchant.email;

      if (!emailForLink) {
        console.log('[LoginMerchant] No email in merchant_profiles, checking auth.users...');
        const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(merchant.id);

        if (authError || !authUser?.user) {
          console.error('[LoginMerchant] Could not fetch auth user:', authError);
          return new Response(JSON.stringify({ error: 'Login failed. Account not found.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }

        emailForLink = authUser.user.email || '';
        console.log('[LoginMerchant] Got email from auth.users:', emailForLink ? 'yes' : 'no');
      }

      if (!emailForLink) {
        console.error('[LoginMerchant] No email found anywhere for merchant:', merchant.id);
        return new Response(JSON.stringify({ error: 'Login failed. No email associated with this account.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
    }

    console.log('[LoginMerchant] Generating magic link for:', merchant.id);

    // Generate a magic link for this user via Admin API
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: emailForLink,
    });

    if (linkError || !linkData) {
      console.error('[LoginMerchant] Magic link generation failed:', linkError);
      return new Response(JSON.stringify({ error: 'Login failed. Could not generate login token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Extract token_hash from the generated link properties
    const tokenHash = linkData.properties?.hashed_token;

    if (!tokenHash) {
      console.error('[LoginMerchant] No token_hash in link data');
      return new Response(JSON.stringify({ error: 'Login failed. Token generation error.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Update first_login_at if needed
    if (!merchant.first_login_at) {
      await adminClient
        .from('merchant_profiles')
        .update({ first_login_at: new Date().toISOString() })
        .eq('id', merchant.id);
      merchant.first_login_at = new Date().toISOString();
    }

    console.log('[LoginMerchant] Login token generated for:', merchant.id);

    return new Response(JSON.stringify({
      user: merchant,
      token_hash: tokenHash,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[LoginMerchant] Error:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
