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

// General account/dashboard MANAGEMENT page (deliberately NOT a direct checkout),
// so links/CTAs read as "manage", staying clear of Google's anti-steering flags.
export const MANAGE_SUBSCRIPTION_URL =
  (import.meta as any).env?.VITE_MANAGE_SUBSCRIPTION_URL || 'https://vedicjaalam.com/dashboard';

// Opens the web management page in the system browser (Capacitor Browser).
export async function openManageSubscription(): Promise<void> {
  try {
    await Browser.open({ url: MANAGE_SUBSCRIPTION_URL });
  } catch (e) {
    console.warn('[playCompliance] Could not open manage-subscription URL:', (e as any)?.message);
  }
}
