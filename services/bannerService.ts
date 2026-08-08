import { supabase } from './supabaseClient';

export interface ActiveBanner {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
}

export const bannerService = {
  /** The active, un-acknowledged banner for this user/audience (or null). */
  async getActiveBanner(
    audience: 'consumer' | 'merchant',
    userId: string,
    city?: string | null,
  ): Promise<ActiveBanner | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-active-banner', {
        body: { audience, user_id: userId, city: city || undefined },
      });
      if (error || !data || (data as any).error) return null;
      return ((data as any).banner as ActiveBanner) || null;
    } catch {
      return null;
    }
  },

  /** Mark a banner acknowledged (tapped OK) so it never shows again for this user. */
  async ackBanner(bannerId: string, userId: string): Promise<void> {
    try {
      await supabase.functions.invoke('ack-banner', { body: { banner_id: bannerId, user_id: userId } });
    } catch {
      /* best-effort; a missed ack just means it may reappear next poll */
    }
  },
};
