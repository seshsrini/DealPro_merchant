import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    // Authenticate caller
    const authHeader = req.headers.get('Authorization')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { action } = body;

    // Resolve caller's merchant context
    // A user may have multiple merchant_staff rows (e.g., owner of their own bare profile
    // AND staff of another merchant). Prioritize staff/manager over self-owned.
    const { data: staffRows } = await adminClient
      .from('merchant_staff')
      .select('merchant_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('role', { ascending: true }); // manager/staff sort before owner

    // Pick the best row: prefer staff/manager role (where merchant_id != user.id)
    let staffRow = (staffRows || []).find(r => r.merchant_id !== user.id) || (staffRows || [])[0] || null;

    let callerMerchantId = staffRow?.merchant_id || user.id;
    let callerRole = staffRow?.role || 'owner';

    if (!staffRow) {
      // No merchant_staff rows at all — check if this user is a merchant owner
      const { data: profile } = await adminClient
        .from('merchant_profiles')
        .select('id, full_name, store_name, phone, role')
        .eq('id', user.id)
        .eq('role', 'merchant')
        .maybeSingle();

      if (profile) {
        // Auto-create owner row in merchant_staff
        await adminClient.from('merchant_staff').upsert({
          merchant_id: profile.id,
          user_id: profile.id,
          role: 'owner',
          display_name: (profile as any).full_name || profile.store_name || 'Owner',
          phone: profile.phone,
          status: 'active',
        }, { onConflict: 'merchant_id,user_id', ignoreDuplicates: true });
        console.log('[manage-staff] Auto-created owner row for merchant:', profile.id);
        callerMerchantId = profile.id;
        callerRole = 'owner';
      }
    }

    console.log('[manage-staff] Resolved context — merchantId:', callerMerchantId, 'role:', callerRole, 'userId:', user.id);

    // ─── ACTION: list_staff ───
    if (action === 'list_staff') {
      const { data: staff } = await adminClient
        .from('merchant_staff')
        .select('id, user_id, role, display_name, phone, status, created_at, last_active_at')
        .eq('merchant_id', callerMerchantId)
        .order('role', { ascending: true })
        .order('created_at', { ascending: true });

      // Enrich owner/staff display names with actual names from merchant_profiles
      const enrichedStaff = staff || [];
      if (enrichedStaff.length > 0) {
        const userIds = enrichedStaff.map(s => s.user_id);
        const { data: profiles } = await adminClient
          .from('merchant_profiles')
          .select('id, full_name, store_name')
          .in('id', userIds);

        if (profiles) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          for (const member of enrichedStaff) {
            const profile = profileMap.get(member.user_id);
            if (profile) {
              // Use full_name first, then store_name, then existing display_name
              const betterName = profile.full_name || profile.store_name;
              if (betterName && (member.display_name === 'Owner' || !member.display_name)) {
                member.display_name = betterName;
              }
            }
          }
        }
      }

      const { data: invites } = await adminClient
        .from('merchant_staff_invites')
        .select('id, invite_code, role, display_name, phone, status, created_at, expires_at')
        .eq('merchant_id', callerMerchantId)
        .in('status', ['pending'])
        .order('created_at', { ascending: false });

      return new Response(JSON.stringify({ staff: enrichedStaff, invites: invites || [], callerRole, callerUserId: user.id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: invite_staff ───
    if (action === 'invite_staff') {
      if (callerRole !== 'owner') {
        return new Response(JSON.stringify({ error: 'Only the account owner can invite staff.' }), {
          status: 403, headers: corsHeaders,
        });
      }

      const { display_name, phone, role } = body;
      if (!display_name?.trim()) {
        return new Response(JSON.stringify({ error: 'Staff name is required.' }), { status: 400, headers: corsHeaders });
      }
      const staffRole = role === 'manager' ? 'manager' : 'staff';

      // Store the invite phone as the plain last-10-digits, so it matches the
      // phone login-merchant normalizes a staff member's number to (regardless of
      // whether the merchant typed +91, a country code, or spaces). A format
      // mismatch here means the staff invite never matches on login and the staff
      // member gets bounced into the signup wizard.
      const invitePhone = (() => {
        const digits = (phone || '').replace(/\D/g, '');
        return digits.length >= 10 ? digits.slice(-10) : (digits || null);
      })();

      // Generate unique invite code
      let inviteCode = generateInviteCode();
      let attempts = 0;
      while (attempts < 5) {
        const { data: existing } = await adminClient
          .from('merchant_staff_invites')
          .select('id')
          .eq('invite_code', inviteCode)
          .maybeSingle();
        if (!existing) break;
        inviteCode = generateInviteCode();
        attempts++;
      }

      const { data: invite, error: inviteErr } = await adminClient
        .from('merchant_staff_invites')
        .insert({
          merchant_id: callerMerchantId,
          invited_by: user.id,
          invite_code: inviteCode,
          role: staffRole,
          display_name: display_name.trim(),
          phone: invitePhone,
          status: 'pending',
        })
        .select()
        .single();

      if (inviteErr) {
        console.error('[manage-staff] Invite error:', inviteErr.message);
        return new Response(JSON.stringify({ error: 'Failed to create invitation.' }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true, invite }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: accept_invite ───
    if (action === 'accept_invite') {
      const { invite_code } = body;
      if (!invite_code?.trim()) {
        return new Response(JSON.stringify({ error: 'Invite code is required.' }), { status: 400, headers: corsHeaders });
      }

      const { data: invite } = await adminClient
        .from('merchant_staff_invites')
        .select('*')
        .eq('invite_code', invite_code.trim().toUpperCase())
        .eq('status', 'pending')
        .single();

      if (!invite) {
        return new Response(JSON.stringify({ error: 'Invalid or expired invite code.' }), { status: 404, headers: corsHeaders });
      }

      if (new Date(invite.expires_at) < new Date()) {
        await adminClient.from('merchant_staff_invites').update({ status: 'expired' }).eq('id', invite.id);
        return new Response(JSON.stringify({ error: 'This invite has expired.' }), { status: 410, headers: corsHeaders });
      }

      // Check if user already linked to this merchant
      const { data: existing } = await adminClient
        .from('merchant_staff')
        .select('id')
        .eq('merchant_id', invite.merchant_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: 'You are already part of this merchant team.' }), { status: 409, headers: corsHeaders });
      }

      // Get staff member's actual phone from their profile
      const { data: staffProfile } = await adminClient
        .from('merchant_profiles')
        .select('phone')
        .eq('id', user.id)
        .maybeSingle();

      // Create staff record
      const { error: staffErr } = await adminClient
        .from('merchant_staff')
        .insert({
          merchant_id: invite.merchant_id,
          user_id: user.id,
          role: invite.role,
          display_name: invite.display_name,
          phone: staffProfile?.phone || invite.phone,
          invited_by: invite.invited_by,
          status: 'active',
        });

      if (staffErr) {
        console.error('[manage-staff] Accept error:', staffErr.message);
        return new Response(JSON.stringify({ error: 'Failed to join team.' }), { status: 500, headers: corsHeaders });
      }

      // Mark invite as accepted
      await adminClient.from('merchant_staff_invites').update({ status: 'accepted' }).eq('id', invite.id);

      return new Response(JSON.stringify({ success: true, message: 'You have joined the merchant team.' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: update_staff ───
    if (action === 'update_staff') {
      if (callerRole !== 'owner') {
        return new Response(JSON.stringify({ error: 'Only the account owner can manage staff.' }), { status: 403, headers: corsHeaders });
      }

      const { staff_id, status: newStatus, role: newRole } = body;
      if (!staff_id) {
        return new Response(JSON.stringify({ error: 'Staff ID is required.' }), { status: 400, headers: corsHeaders });
      }

      // Prevent modifying owner
      const { data: target } = await adminClient
        .from('merchant_staff')
        .select('user_id, role, merchant_id')
        .eq('id', staff_id)
        .single();

      if (!target || target.merchant_id !== callerMerchantId) {
        return new Response(JSON.stringify({ error: 'Staff member not found.' }), { status: 404, headers: corsHeaders });
      }
      if (target.role === 'owner') {
        return new Response(JSON.stringify({ error: 'Cannot modify the owner account.' }), { status: 403, headers: corsHeaders });
      }

      const updates: Record<string, any> = {};
      if (newStatus && ['active', 'suspended'].includes(newStatus)) updates.status = newStatus;
      if (newRole && ['manager', 'staff'].includes(newRole)) updates.role = newRole;

      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: 'No valid updates provided.' }), { status: 400, headers: corsHeaders });
      }

      await adminClient.from('merchant_staff').update(updates).eq('id', staff_id);

      // Robust lockout: when suspending, revoke the staff member's existing Supabase
      // sessions so their app can't refresh past its current (≤1h) access token.
      // Best-effort — the per-request active-actor gate is the hard guarantee, so a
      // failure here (e.g. older GoTrue) does NOT weaken the block on server actions.
      if (updates.status === 'suspended' && target.user_id) {
        try {
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${target.user_id}/logout`, {
            method: 'POST',
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          });
          console.log('[manage-staff] Revoked sessions for suspended staff:', target.user_id);
        } catch (e: any) {
          console.warn('[manage-staff] session revoke failed (non-fatal):', e?.message);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: session_check ─── (client polls this to self-eject when disabled)
    if (action === 'session_check') {
      const { data: active } = await adminClient.rpc('merchant_is_active_actor', { p_user_id: user.id });
      // Fail-open: treat null (RPC not yet deployed) as active so a rollout gap
      // never logs everyone out; only an explicit false ejects the user.
      return new Response(JSON.stringify({ active: active !== false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: revoke_invite ───
    if (action === 'revoke_invite') {
      if (callerRole !== 'owner') {
        return new Response(JSON.stringify({ error: 'Only the account owner can revoke invites.' }), { status: 403, headers: corsHeaders });
      }

      const { invite_id } = body;
      await adminClient.from('merchant_staff_invites').update({ status: 'revoked' }).eq('id', invite_id).eq('merchant_id', callerMerchantId);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: update_invite ─── (change a PENDING invite's role before it's accepted)
    if (action === 'update_invite') {
      if (callerRole !== 'owner') {
        return new Response(JSON.stringify({ error: 'Only the account owner can change invite roles.' }), { status: 403, headers: corsHeaders });
      }
      const { invite_id, role: newRole } = body;
      if (!invite_id || !['manager', 'staff'].includes(newRole)) {
        return new Response(JSON.stringify({ error: 'A valid invite and role (manager or staff) are required.' }), { status: 400, headers: corsHeaders });
      }
      // Scope to the caller's own merchant AND only while still pending — an
      // accepted invite's role now lives on merchant_staff (change it there).
      const { data: updated, error: updErr } = await adminClient
        .from('merchant_staff_invites')
        .update({ role: newRole })
        .eq('id', invite_id)
        .eq('merchant_id', callerMerchantId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      if (updErr) {
        return new Response(JSON.stringify({ error: 'Could not update the invite. Please try again.' }), { status: 500, headers: corsHeaders });
      }
      if (!updated) {
        return new Response(JSON.stringify({ error: 'Invite not found or already accepted.' }), { status: 404, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: get_permissions ───
    if (action === 'get_permissions') {
      const { data: perms } = await adminClient
        .from('merchant_permissions')
        .select('permission, allowed')
        .eq('role', callerRole)
        .eq('allowed', true);

      return new Response(JSON.stringify({
        role: callerRole,
        merchantId: callerMerchantId,
        permissions: (perms || []).map(p => p.permission),
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: list_role_permissions (owner only — for permissions editor) ───
    if (action === 'list_role_permissions') {
      if (callerRole !== 'owner') {
        return new Response(JSON.stringify({ error: 'Only the account owner can view role permissions.' }), { status: 403, headers: corsHeaders });
      }

      const { data: allPerms } = await adminClient
        .from('merchant_permissions')
        .select('role, permission, allowed')
        .in('role', ['manager', 'staff'])
        .order('role')
        .order('permission');

      return new Response(JSON.stringify({ permissions: allPerms || [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── ACTION: update_permission (owner only) ───
    if (action === 'update_permission') {
      if (callerRole !== 'owner') {
        return new Response(JSON.stringify({ error: 'Only the account owner can update permissions.' }), { status: 403, headers: corsHeaders });
      }

      const { role: targetRole, permission, allowed } = body;
      if (!targetRole || !permission || typeof allowed !== 'boolean') {
        return new Response(JSON.stringify({ error: 'role, permission, and allowed are required.' }), { status: 400, headers: corsHeaders });
      }
      if (targetRole === 'owner') {
        return new Response(JSON.stringify({ error: 'Cannot modify owner permissions.' }), { status: 403, headers: corsHeaders });
      }

      const { error: updateErr } = await adminClient
        .from('merchant_permissions')
        .update({ allowed })
        .eq('role', targetRole)
        .eq('permission', permission);

      if (updateErr) {
        console.error('[manage-staff] Permission update error:', updateErr.message);
        return new Response(JSON.stringify({ error: 'Failed to update permission.' }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });

  } catch (err: any) {
    console.error('[manage-staff] Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
