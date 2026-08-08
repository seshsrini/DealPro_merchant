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

      // Check if a profile already exists for this auth user (phone lookup may have missed it)
      const { data: existingProfile } = await adminClient
        .from('merchant_profiles')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      if (existingProfile) {
        console.log('[MerchantOtpLogin] Profile already exists for auth user:', authUserId, '— using it');
        merchantProfile = existingProfile;
      } else {
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
          if (authUserId) await adminClient.auth.admin.deleteUser(authUserId);
          return new Response(JSON.stringify({ error: 'Registration failed. Please try again.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        merchantProfile = newProfile;
        console.log('[MerchantOtpLogin] New merchant registered:', merchantProfile.id);
      }
    }

    // Check if this user is a staff member (not the owner)
    let staffRole: string | null = null;
    let ownerMerchantId: string | null = null;

    // First check if already an accepted staff member
    // Query ALL active rows for this user, then pick the staff/manager one
    const { data: allStaffRows, error: staffLookupErr } = await adminClient
      .from('merchant_staff')
      .select('merchant_id, role')
      .eq('user_id', merchantProfile.id)
      .eq('status', 'active');

    console.log('[MerchantOtpLogin] Staff lookup for user', merchantProfile.id, '→ rows:', JSON.stringify(allStaffRows), 'err:', staffLookupErr?.message);

    // Prefer the staff/manager row (where they're NOT the owner of their own bare profile)
    const staffRecord = (allStaffRows || []).find(r => r.role !== 'owner' && r.merchant_id !== merchantProfile.id)
      || (allStaffRows || []).find(r => r.role !== 'owner')
      || null;

    if (staffRecord) {
      staffRole = staffRecord.role;
      ownerMerchantId = staffRecord.merchant_id;
      console.log('[MerchantOtpLogin] Found existing staff record — role:', staffRole, 'owner:', ownerMerchantId);
    }

    // If not yet a staff member, check for a pending invite by code OR phone
    if (!staffRecord) {
      let pendingInvite = null;

      // Priority 1: match by invite code (if provided)
      if (invite_code) {
        const { data } = await adminClient
          .from('merchant_staff_invites')
          .select('*')
          .eq('invite_code', invite_code.trim().toUpperCase())
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (data) pendingInvite = data;
        console.log('[MerchantOtpLogin] Invite code lookup:', invite_code, '→', pendingInvite ? 'FOUND' : 'NOT FOUND');
      }

      // Priority 2: match by phone number. The invite phone may have been stored
      // in different formats depending on how the merchant typed it when adding
      // the staff (plain 10-digit, 91-prefixed, +91-prefixed, or with spaces), so
      // match against all common variants of the same number — otherwise a real
      // staff member falls through and gets sent into the signup wizard.
      if (!pendingInvite && normalizedPhone) {
        const last10 = cleanPhone.slice(-10);
        const phoneVariants = Array.from(new Set([
          last10,
          normalizedPhone,
          `91${last10}`,
          `+91${last10}`,
          cleanPhone,
        ].filter(Boolean)));
        const { data } = await adminClient
          .from('merchant_staff_invites')
          .select('*')
          .in('phone', phoneVariants)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) pendingInvite = data;
      }

      if (pendingInvite) {
        console.log('[MerchantOtpLogin] Found pending invite for phone:', normalizedPhone, 'code:', pendingInvite.invite_code);

        // Auto-accept: create merchant_staff row (upsert to handle duplicates)
        const { error: staffErr } = await adminClient
          .from('merchant_staff')
          .upsert({
            merchant_id: pendingInvite.merchant_id,
            user_id: merchantProfile.id,
            role: pendingInvite.role,
            display_name: pendingInvite.display_name,
            phone: normalizedPhone,
            invited_by: pendingInvite.invited_by,
            status: 'active',
          }, { onConflict: 'merchant_id,user_id' });

        if (!staffErr) {
          // Mark invite as accepted
          await adminClient
            .from('merchant_staff_invites')
            .update({ status: 'accepted' })
            .eq('id', pendingInvite.id);

          staffRole = pendingInvite.role;
          ownerMerchantId = pendingInvite.merchant_id;
          console.log('[MerchantOtpLogin] Auto-accepted invite — role:', staffRole, 'owner:', ownerMerchantId);
        } else {
          console.error('[MerchantOtpLogin] Failed to auto-accept invite:', staffErr.message);
        }
      }
    }

    // If staff member (accepted or just auto-accepted), load owner's profile
    if (staffRole && ownerMerchantId) {
      console.log('[MerchantOtpLogin] Staff member detected — role:', staffRole, 'owner:', ownerMerchantId);

      const { data: ownerProfile } = await adminClient
        .from('merchant_profiles')
        .select('*')
        .eq('id', ownerMerchantId)
        .single();

      if (ownerProfile) {
        const staffUserId = merchantProfile.id;
        const staffPhone = merchantProfile.phone;
        merchantProfile = {
          ...ownerProfile,
          id: staffUserId,
          phone: staffPhone,
          staff_role: staffRole,
          staff_merchant_id: ownerMerchantId,
        };
      }
    }

    // Robust lockout: a disabled/resigned staff member (suspended membership, owns
    // no store of their own, no active membership) may not log in — deny with a
    // clear message instead of silently dropping them into an empty account.
    const { data: __canAct } = await adminClient.rpc('merchant_is_active_actor', { p_user_id: merchantProfile.id });
    if (__canAct === false) {
      console.log('[MerchantOtpLogin] Denying disabled staff login:', merchantProfile.id);
      return new Response(JSON.stringify({ error: 'ACCESS_DISABLED', message: 'Your access has been disabled by the store owner. Please contact them if this is a mistake.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
      });
    }

    console.log('[MerchantOtpLogin] Merchant found:', merchantProfile.id, 'role:', merchantProfile.role, 'staff_role:', staffRole);

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

    // Fetch subscription status and store count for the actual merchant owner
    // Staff members inherit the owner's subscription and stores
    const effectiveMerchantId = ownerMerchantId || merchantProfile.id;
    const now = new Date().toISOString();
    const { data: activeSub } = await adminClient
      .from('merchant_subscriptions')
      .select('id, status, plan_name, current_period_end, trial_end')
      .eq('merchant_id', effectiveMerchantId)
      .eq('status', 'active')
      .gte('current_period_end', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: storeCount } = await adminClient
      .from('merchant_stores')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', effectiveMerchantId);

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
