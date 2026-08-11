import { supabase } from './supabaseClient';

export interface StaffMember {
  id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'staff';
  display_name: string;
  phone: string | null;
  status: 'invited' | 'active' | 'suspended';
  created_at: string;
  last_active_at: string | null;
}

export interface StaffInvite {
  id: string;
  invite_code: string;
  role: 'manager' | 'staff';
  display_name: string;
  phone: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
}

export const merchantStaffService = {
  async listStaff(): Promise<{ staff: StaffMember[]; invites: StaffInvite[]; callerRole?: string; callerUserId?: string }> {
    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'list_staff' },
    });
    if (error) throw new Error('Unable to load team members. Please try again.');
    return data as { staff: StaffMember[]; invites: StaffInvite[]; callerRole?: string; callerUserId?: string };
  },

  async inviteStaff(params: {
    display_name: string;
    phone?: string;
    role: 'manager' | 'staff';
  }): Promise<{ success: boolean; invite: StaffInvite }> {
    console.log('[merchantStaffService] Calling manage-staff invite_staff with:', params);
    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'invite_staff', ...params },
    });
    console.log('[merchantStaffService] Response — data:', data, 'error:', error);
    if (error) {
      console.error('[merchantStaffService] invite_staff error:', error);
      let errMsg = 'Unable to send invitation. Please try again.';
      try {
        const body = await (error as any).context?.json?.();
        console.error('[merchantStaffService] Error body:', body);
        if (body?.error) errMsg = body.error;
      } catch {}
      throw new Error(errMsg);
    }
    return data;
  },

  async updateStaff(staffId: string, updates: { status?: string; role?: string }): Promise<void> {
    const { error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'update_staff', staff_id: staffId, ...updates },
    });
    if (error) throw new Error('Unable to update staff member. Please try again.');
  },

  async revokeInvite(inviteId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'revoke_invite', invite_id: inviteId },
    });
    if (error) throw new Error('Unable to revoke invitation. Please try again.');
  },

  // Change a still-pending invite's role (manager/staff) before it's accepted.
  async updateInviteRole(inviteId: string, role: 'manager' | 'staff'): Promise<void> {
    const { error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'update_invite', invite_id: inviteId, role },
    });
    if (error) throw new Error('Unable to update invite role. Please try again.');
  },

  async getPermissions(): Promise<{ role: string; merchantId: string; permissions: string[] }> {
    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'get_permissions' },
    });
    if (error) throw new Error('Unable to load permissions.');
    return data;
  },

  async listRolePermissions(): Promise<{ role: string; permission: string; allowed: boolean }[]> {
    const { data, error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'list_role_permissions' },
    });
    if (error) throw new Error('Unable to load role permissions.');
    return data.permissions || [];
  },

  async updatePermission(role: string, permission: string, allowed: boolean): Promise<void> {
    const { error } = await supabase.functions.invoke('manage-staff', {
      body: { action: 'update_permission', role, permission, allowed },
    });
    if (error) throw new Error('Unable to update permission.');
  },
};
