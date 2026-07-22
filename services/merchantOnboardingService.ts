import { supabase } from './supabaseClient';

export const merchantOnboardingService = {
  /**
   * Silently saves partial onboarding progress to merchant_profiles (and optionally
   * merchant_stores). Safe to call after each wizard step — errors are swallowed
   * so a network hiccup never blocks navigation.
   */
  patchProfile: async (patch: {
    fullName?: string;
    storeName?: string;
    category?: string;
    businessType?: string;
    gstin?: string | null;
    pan?: string | null;
    udyamNo?: string | null;
    fssaiNo?: string | null;
    tradeLicenseNo?: string | null;
    termsAccepted?: boolean;
    privacyAccepted?: boolean;
    stores?: Array<{
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
    }>;
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
