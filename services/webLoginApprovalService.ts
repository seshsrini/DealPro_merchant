import { supabase } from './supabaseClient';

/**
 * webLoginApprovalService — mobile side of the "approve web login from your
 * phone" flow. Calls the authenticated `web-login-approve` edge function; the
 * supabaseClient.functions.invoke wrapper attaches the merchant's fresh JWT
 * automatically (this function is NOT in unauthFunctions).
 */

export interface PendingWebLogin {
  request_id: string;
  request_code: string;
  requester_label: string | null;
  created_at: string;
  expires_at: string;
}

export const webLoginApprovalService = {
  /** Pending web-login requests for the logged-in merchant. */
  async listPending(): Promise<PendingWebLogin[]> {
    try {
      const { data, error } = await supabase.functions.invoke('web-login-approve', {
        body: { action: 'list' },
      });
      if (error) return [];
      return (data?.requests || []) as PendingWebLogin[];
    } catch {
      return [];
    }
  },

  /** Approve or deny a specific request. Returns true on success. */
  async decide(requestId: string, approve: boolean): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('web-login-approve', {
        body: { action: 'decide', request_id: requestId, approve },
      });
      if (error) return false;
      return !!data?.ok;
    } catch {
      return false;
    }
  },
};
