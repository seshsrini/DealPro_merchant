
import { supabase } from "./supabaseClient";

export const MreferralService = {
  onInviteSent: async (
    referrerId: string, 
    referralCode: string, 
    inviteePhoneNumber: string | null, 
    inviteeEmail: string | null
  ) => {
    // 1. Validation
    if (!referrerId || !referralCode) {
      const msg = `Referral Error: Missing ${!referrerId ? 'User ID' : 'Referral Code'}`;
      console.error(msg);
      throw new Error(msg); 
    }

    // 2. THE FIX: Changed 'send-invite' to 'on-invite-sent' to match your deployment
    const { data, error } = await supabase.functions.invoke('on-invite-sent', {
      body: { 
        referrerId, 
        inviteePhoneNumber, 
        inviteeEmail, 
        referralCode 
      },
    });

    if (error) {
      console.error("Edge Function Invoke Error:", error);
      throw error; 
    }

    return data;
  },

  onSubscriptionActive: async (refereeId: string, refereePhoneNumber: string) => {
    if (!refereeId) throw new Error("Missing refereeId");

    // Double check if this function name is also correct in your list!
    const { data, error } = await supabase.functions.invoke('on-subscription-active', {
      body: { refereeId, refereePhoneNumber },
    });

    if (error) throw error;
    return data;
  },
};