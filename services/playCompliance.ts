import { Browser } from '@capacitor/browser';

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

// Opens the web management page in the system browser (Capacitor Browser),
// carrying the merchant id so the page can pre-populate their account + plan.
export async function openManageSubscription(merchantId?: string): Promise<void> {
  try {
    let url = MANAGE_SUBSCRIPTION_URL;
    if (merchantId) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}merchant_id=${encodeURIComponent(merchantId)}`;
    }
    await Browser.open({ url });
  } catch (e) {
    console.warn('[playCompliance] Could not open manage-subscription URL:', (e as any)?.message);
  }
}
