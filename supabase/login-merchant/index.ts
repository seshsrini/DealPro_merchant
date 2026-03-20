// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined; };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function applyRateLimit(req: Request): { allowed: boolean; response?: Response } {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const now = Date.now();
  const limit = 10;
  const window = 60000;

  const record = rateLimitMap.get(ip);
  if (record && now < record.resetTime) {
    if (record.count >= limit) {
      return {
        allowed: false,
        response: new Response(JSON.stringify({ error: 'Too many attempts. Please try again later.' }), {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const rateLimit = applyRateLimit(req);
  if (!rateLimit.allowed) return rateLimit.response!;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { phone, country_code, invite_code } = body;

    if (!phone) {
      return new Response(JSON.stringify({ error: 'Phone number required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const cc = (country_code || '+91').replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');

    // Normalize phone: strip country code prefix if present
    let normalizedPhone = cleanPhone;
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      normalizedPhone = cleanPhone.substring(2);
    } else if (cleanPhone.length === 10) {
      normalizedPhone = cleanPhone;
    }

    console.log('[MerchantOtpLogin] Login attempt for phone:', normalizedPhone);

    // Look up user in merchant_profiles
    let { data: merchantProfile, error: lookupError } = await adminClient
      .from('merchant_profiles')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (lookupError) {
      console.error('[MerchantOtpLogin] Lookup error:', lookupError);
      return new Response(JSON.stringify({ error: 'User lookup failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    // Generate a unique 6-char alphanumeric referral code (ambiguity-free charset)
    async function generateUniqueCode(column: string): Promise<string> {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (let attempt = 0; attempt < 5; attempt++) {
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars[Math.floor(Math.random() * chars.length)];
        }
        const { data } = await adminClient
          .from('merchant_profiles')
          .select('id')
          .eq(column, code)
          .maybeSingle();
        if (!data) return code;
      }
      throw new Error('Failed to generate unique referral code after 5 attempts');
    }

    // Auto-register new merchant if not found — onboarding wizard collects details later
    if (!merchantProfile) {
      console.log('[MerchantOtpLogin] No merchant found, auto-registering:', normalizedPhone);
      const internalEmail = `${cc}${normalizedPhone}@internal.dealpro.merchant`;

      let authUserId: string | null = null;

      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: internalEmail,
        email_confirm: true,
        user_metadata: { role: 'merchant', phone: normalizedPhone },
      });

      if (authError) {
        // User likely already exists — find them by email
        if (authError.message?.includes('already been registered') || authError.message?.includes('email_exists')) {
          console.log('[MerchantOtpLogin] Auth user already exists, looking up by email:', internalEmail);
          const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 100 });
          const found = listData?.users?.find((u: any) => u.email === internalEmail);
          if (found) {
            authUserId = found.id;
          } else {
            console.error('[MerchantOtpLogin] User exists but not found in listUsers');
            return new Response(JSON.stringify({ error: 'Registration failed. Please try again.' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }
        } else {
          console.error('[MerchantOtpLogin] Failed to create auth user:', authError.message);
          return new Response(JSON.stringify({ error: 'Registration failed. Please try again.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
      } else {
        authUserId = authData.user.id;
        console.log('[MerchantOtpLogin] Created new auth user:', authUserId);
      }

      // Generate unique referral codes for this merchant
      const consumerRefCode = await generateUniqueCode('consumer_referral_code');
      const merchantRefCode = await generateUniqueCode('merchant_referral_code');
      console.log('[MerchantOtpLogin] Generated referral codes — consumer:', consumerRefCode, 'merchant:', merchantRefCode);

      // Create minimal merchant_profiles row — onboarding wizard fills the rest
      const { data: newProfile, error: profileError } = await adminClient
        .from('merchant_profiles')
        .insert({
          id: authUserId,
          phone: normalizedPhone,
          country_code: `+${cc}`,
          role: 'merchant',
          active_status: true,
          consumer_referral_code: consumerRefCode,
          merchant_referral_code: merchantRefCode,
          ...(invite_code ? { invite_code } : {}),
        })
        .select()
        .single();

      if (profileError) {
        console.error('[MerchantOtpLogin] Failed to create profile:', profileError);
        // Rollback: delete the auth user we just created
        if (authUserId) await adminClient.auth.admin.deleteUser(authUserId);
        return new Response(JSON.stringify({ error: 'Registration failed. Please try again.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
      merchantProfile = newProfile;
      console.log('[MerchantOtpLogin] New merchant registered:', merchantProfile.id);
    }

    console.log('[MerchantOtpLogin] Merchant found:', merchantProfile.id, 'role:', merchantProfile.role);

    // Store invite_code on existing merchant if provided and not already set
    if (invite_code && !merchantProfile.invite_code) {
      await adminClient
        .from('merchant_profiles')
        .update({ invite_code })
        .eq('id', merchantProfile.id);
      merchantProfile.invite_code = invite_code;
    }

    // Backfill referral codes for existing merchants missing them
    const backfillUpdates: Record<string, string> = {};
    if (!merchantProfile.consumer_referral_code) {
      backfillUpdates.consumer_referral_code = await generateUniqueCode('consumer_referral_code');
    }
    if (!merchantProfile.merchant_referral_code) {
      backfillUpdates.merchant_referral_code = await generateUniqueCode('merchant_referral_code');
    }
    if (Object.keys(backfillUpdates).length > 0) {
      console.log('[MerchantOtpLogin] Backfilling referral codes for:', merchantProfile.id, backfillUpdates);
      await adminClient
        .from('merchant_profiles')
        .update(backfillUpdates)
        .eq('id', merchantProfile.id);
      Object.assign(merchantProfile, backfillUpdates);
    }

    // Look up the merchant's actual stored auth email — handles both
    // legacy (@internal.dealpro.app) and new (@internal.dealpro.merchant) formats
    const { data: authUserData } = await adminClient.auth.admin.getUserById(merchantProfile.id);
    const profileCc = (merchantProfile.country_code || '+91').replace(/\D/g, '');
    const internalEmail = authUserData?.user?.email
      ?? `${profileCc}${merchantProfile.phone}@internal.dealpro.merchant`;

    // Generate a magic link token (no email is actually sent)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: internalEmail,
    });

    if (linkError || !linkData) {
      console.error('[MerchantOtpLogin] generateLink error:', linkError);
      return new Response(JSON.stringify({ error: 'Failed to create login session' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    const tokenHash = linkData.properties?.hashed_token;
    if (!tokenHash) {
      console.error('[MerchantOtpLogin] No hashed_token in generateLink response');
      return new Response(JSON.stringify({ error: 'Failed to create login token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log('[MerchantOtpLogin] Magic link token generated for:', merchantProfile.id);

    // Update last_logged_in
    await adminClient
      .from('merchant_profiles')
      .update({ last_logged_in: new Date().toISOString() })
      .eq('id', merchantProfile.id);

    // Update first_login_at if needed
    if (!merchantProfile.first_login_at) {
      await adminClient
        .from('merchant_profiles')
        .update({ first_login_at: new Date().toISOString() })
        .eq('id', merchantProfile.id);
      merchantProfile.first_login_at = new Date().toISOString();
    }

    merchantProfile.last_logged_in = new Date().toISOString();

    // Fetch subscription status and store count (using adminClient to bypass RLS)
    // This avoids the client needing a separate authenticated call during login
    const now = new Date().toISOString();
    const { data: activeSub } = await adminClient
      .from('merchant_subscriptions')
      .select('id, status, plan_name, current_period_end, trial_end')
      .eq('merchant_id', merchantProfile.id)
      .eq('status', 'active')
      .gte('current_period_end', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: storeCount } = await adminClient
      .from('merchant_stores')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantProfile.id);

    const trialEnd = activeSub?.trial_end || activeSub?.current_period_end;
    const trialExpired = trialEnd ? new Date(trialEnd) < new Date() : false;

    return new Response(JSON.stringify({
      user: merchantProfile,
      token_hash: tokenHash,
      subscription: {
        hasActiveSubscription: !!activeSub,
        subscription_status: activeSub?.status,
        plan_name: activeSub?.plan_name,
        trial_end: activeSub?.trial_end,
        trialExpired,
        storeCount: storeCount ?? 0,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[MerchantOtpLogin] Error:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
