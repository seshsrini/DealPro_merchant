import { supabase } from './supabaseClient';

export const merchantOnboardingService = {
  /**
   * Saves the business registration for an already-onboarded merchant (the
   * "Business registration required" screen). Unlike patchProfile this one is
   * NOT fire-and-forget: it throws with the server's message so the screen can
   * show it.
   */
  setBusinessDocument: async (doc: {
    businessType: 'gstin' | 'udyam' | 'fssai' | 'trade_license';
    gstin?: string | null;
    pan?: string | null;
    udyamNo?: string | null;
    fssaiNo?: string | null;
    tradeLicenseNo?: string | null;
  }): Promise<Record<string, any>> => {
    const { data, error } = await supabase.functions.invoke('set-business-document', { body: doc });
    if (!error && data && !data.error) return data;
    let msg = data?.error as string | undefined;
    if (!msg && error && (error as any).context) {
      try { msg = (await (error as any).context.json())?.error; } catch { /* not JSON */ }
    }
    throw new Error(msg || 'Could not save your business registration. Please try again.');
  },

  /**
   * Saves one signup step into merchant_profiles (via patch-merchant-profile) so
   * partial signups are visible there. Only name, legal/store name, the business
   * document and the step number are accepted — terms/privacy, stores and
   * onboarding_complete are written only by completeMerchantProfile at the end.
   * Errors are swallowed: a network hiccup never blocks the wizard (signup_drafts
   * still holds the full in-progress state).
   */
  patchProfile: async (patch: {
    fullName?: string;
    storeName?: string;
    businessType?: string;
    gstin?: string | null;
    pan?: string | null;
    udyamNo?: string | null;
    fssaiNo?: string | null;
    tradeLicenseNo?: string | null;
    onboardingStep?: number;
  }): Promise<void> => {
    try {
      const { data, error } = await supabase.functions.invoke('patch-merchant-profile', {
        body: patch,
      });
      if (error) {
        console.warn('[merchantOnboardingService] patchProfile edge error (non-fatal):', error);
      } else if (data?.error) {
        console.warn('[merchantOnboardingService] patchProfile app error (non-fatal):', data.error);
      }
    } catch (err: any) {
      console.warn('[merchantOnboardingService] patchProfile failed (non-fatal):', err?.message);
    }
  },

  completeMerchantProfile: async (payload: {
    userId: string;
    fullName: string;
    storeName: string;
    legalName?: string;
    category: string;
    businessType: string;
    gstin?: string | null;
    pan?: string | null;
    udyamNo?: string | null;
    fssaiNo?: string | null;
    tradeLicenseNo?: string | null;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    stores: Array<{
      store_name: string;
      address: string;
      pincode: string;
      locality: string;
      city: string;
      state: string;
      landmark: string;
      store_category: string;
      latitude: number;
      longitude: number;
      store_hrs: string;
      store_phone?: string;
      store_phone_alt?: string;
      whatsapp_chat_enabled?: boolean;
      whatsapp_consent_at?: string | null;
      delivers?: boolean;
      delivery_radius_km?: number | null;
    }>;
  }) => {
    const { data, error } = await supabase.functions.invoke('complete-merchant-profile', {
      body: payload,
    });

    if (error) {
      console.error('[merchantOnboardingService] Edge Function error:', error);
      // A non-2xx response carries the server's { error } body on error.context.
      // Surface it so a real failure isn't hidden behind a generic "check your
      // connection" message that misdirects debugging (this is a 500, not a network
      // problem). Fall back to the generic text if the body can't be read.
      let serverMessage = '';
      try {
        const body = await (error as any)?.context?.json?.();
        serverMessage = body?.error || '';
      } catch { /* body unreadable — use fallback below */ }
      throw new Error(serverMessage || 'Unable to save your profile. Please check your connection and try again.');
    }

    if (data?.error) {
      console.error('[merchantOnboardingService] Application error:', data.error);
      throw new Error(data.error);
    }

    return data;
  },
};
