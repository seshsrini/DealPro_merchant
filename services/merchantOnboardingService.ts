import { supabase } from './supabaseClient';

export const merchantOnboardingService = {
  completeMerchantProfile: async (payload: {
    userId: string;
    fullName: string;
    storeName: string;
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
      latitude: number;
      longitude: number;
      store_hrs: string;
    }>;
  }) => {
    const { data, error } = await supabase.functions.invoke('complete-merchant-profile', {
      body: payload,
    });

    if (error) {
      console.error('[merchantOnboardingService] Edge Function error:', error);
      throw new Error('Unable to save your profile. Please check your connection and try again.');
    }

    if (data?.error) {
      console.error('[merchantOnboardingService] Application error:', data.error);
      throw new Error(data.error);
    }

    return data;
  },
};
