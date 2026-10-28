import { Browser } from '@capacitor/browser';
import { supabase } from './supabaseClient';

// Google Play compliance switch.
//
// When VITE_PLAY_COMPLIANT=true (the build submitted to / shipped on the Play
// Store), the app hides ALL in-app subscription *selling* — plan pickers, prices,
// Select/Subscribe/Upgrade CTAs, and the in-app checkout redirect. It becomes a
// "log in and use" utility tool: billing, plan setup, upgrades and cancellation
// are handled entirely on the web (vedicjaalam.com), and the app only shows
// read-only status + a "manage on the web" action. Deal-posting stays gated on an
// active subscription — that gate is compliant (like a reader app); what's not
// compliant is selling/steering inside the app.
//
// Keep production and the review build IDENTICAL — do not ship a different app to
// reviewers than to users.
export const PLAY_COMPLIANT =
  String((import.meta as any).env?.VITE_PLAY_COMPLIANT || '').toLowerCase() === 'true';

// Web merchant subscription page (plan selection + status + cancel) — a
// management page, NOT a direct in-app checkout. For DEV testing point this at
// the test lane, e.g. https://vedicjaalam.com/merchant/subscribe?test=1
export const MANAGE_SUBSCRIPTION_URL =
  (import.meta as any).env?.VITE_MANAGE_SUBSCRIPTION_URL || 'https://vedicjaalam.com/merchant/subscribe';

// Opens the web management page in the system browser (Capacitor Browser).
// The link carries a one-time pass (issue-billing-pass, valid 10 minutes) that the
// website swaps for a short signed-in session, so plan changes / cancels there are
// tied to this merchant. If a pass can't be obtained (offline, function not yet
// deployed), it falls back to the older merchant_id link, which the website still
// accepts until REQUIRE_BILLING_PASS is switched on.
export async function openManageSubscription(merchantId?: string): Promise<void> {
  try {
    const sep = MANAGE_SUBSCRIPTION_URL.includes('?') ? '&' : '?';
    let url = MANAGE_SUBSCRIPTION_URL;
    try {
      const { data, error } = await supabase.functions.invoke('issue-billing-pass', { body: {} });
      if (!error && typeof data?.pass === 'string' && data.pass) {
        url = `${MANAGE_SUBSCRIPTION_URL}${sep}pass=${encodeURIComponent(data.pass)}`;
      }
    } catch (e) {
      console.warn('[playCompliance] Billing pass unavailable, using legacy link:', (e as any)?.message);
    }
    if (url === MANAGE_SUBSCRIPTION_URL && merchantId) {
      url = `${MANAGE_SUBSCRIPTION_URL}${sep}merchant_id=${encodeURIComponent(merchantId)}`;
    }
    await Browser.open({ url });
  } catch (e) {
    console.warn('[playCompliance] Could not open manage-subscription URL:', (e as any)?.message);
  }
}
