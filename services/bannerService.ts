import { supabase } from './supabaseClient';

export interface ActiveBanner {
  id: string;
  title: string;
  message: string;              // may contain basic HTML (<b>, <br>, <a>, …)
  image_url: string | null;
  link_label: string | null;    // CTA text
  link_url: string | null;      // external URL (opens browser)
  link_search: string | null;   // in-app deal-search term (consumer)
}

export const bannerService = {
  /** The active, un-acknowledged banner for this user/audience (or null). Geo is
   *  resolved server-side from the user's profile / stores. */
  async getActiveBanner(
    audience: 'consumer' | 'merchant',
    userId: string,
  ): Promise<ActiveBanner | null> {
    try {
      const { data, error } = await supabase.functions.invoke('get-active-banner', {
        body: { audience, user_id: userId },
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
