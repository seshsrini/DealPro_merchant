import { Browser } from '@capacitor/browser';

// -----------------------------------------------------------------------------
// Subscription checkout — REDIRECT to the VedicJaalam web page (Play-compliant).
//
// Google Play does not allow third-party payment (Razorpay) for subscriptions
// *inside* the app, so payment happens on the web instead:
//
//   1. The app opens vedicjaalam.com/subscribe?tier_key=…&merchant_id=…
//      in the system browser (Capacitor Browser).
//   2. That page (Next.js) creates the Razorpay subscription via its own API
//      route, runs Razorpay Checkout in the browser, verifies the signature
//      (writing a `pending_activation` row), and then redirects back to the app
//      via a `dealpro://paid?...` deep link (and a postMessage for web testing).
//   3. App.tsx catches that deep link / message and polls merchant_subscriptions
//      until the razorpay-webhook function flips status to 'active'.
//
// This replaces the previous in-app Razorpay Checkout (which was a Play-policy
// risk). Override the page URL with VITE_SUBSCRIBE_URL for non-prod testing
// (e.g. a Vercel preview wired to the DEV Supabase project).
// -----------------------------------------------------------------------------

const SUBSCRIBE_URL =
  (import.meta as any).env?.VITE_SUBSCRIBE_URL || 'https://vedicjaalam.com/subscribe';

// -----------------------------------------------------------------------------
// "Payment pending" flag — set ONLY when the merchant actually launches the web
// checkout. App.tsx gates its on-foreground activation re-poll (and therefore
// the "Activating your subscription" / "Almost there" overlay) on this flag, so
// the overlay never appears for a merchant who hasn't started a payment — e.g.
// while they're still in the signup wizard and the app foregrounds. The flag is
// persisted so it survives the app being backgrounded during the Razorpay
// browser, and self-expires so a stale flag can't haunt later sessions.
const PAYMENT_PENDING_KEY = 'dealpro_payment_pending';
const PAYMENT_PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function markPaymentPending(): void {
  try { localStorage.setItem(PAYMENT_PENDING_KEY, String(Date.now())); } catch { /* ignore */ }
}

export function clearPaymentPending(): void {
  try { localStorage.removeItem(PAYMENT_PENDING_KEY); } catch { /* ignore */ }
}

export function isPaymentPending(): boolean {
  try {
    const raw = localStorage.getItem(PAYMENT_PENDING_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (isNaN(ts) || Date.now() - ts > PAYMENT_PENDING_TTL_MS) {
      localStorage.removeItem(PAYMENT_PENDING_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export interface OpenCheckoutInput {
  tierKey: string;
  merchantId: string;
}

export interface OpenCheckoutResult {
  /** Payment continues in the browser; activation arrives via the deep link. */
  status: 'redirected';
}

export const razorpayCheckoutService = {
  async openCheckout(input: OpenCheckoutInput): Promise<OpenCheckoutResult> {
    const params = new URLSearchParams({
      tier_key: input.tierKey,
      merchant_id: input.merchantId,
    });
    const url = `${SUBSCRIBE_URL}?${params.toString()}`;
    console.log('[razorpayCheckout] Opening Play-compliant web checkout:', url);
    // Mark a payment as in-progress so the app's on-foreground activation poll
    // (and its overlay) only runs for merchants who actually started checkout.
    markPaymentPending();
    await Browser.open({ url });
    // Result is asynchronous: the merchant pays on the web page and returns via
    // the dealpro://paid deep link, which App.tsx handles (polls for 'active').
    return { status: 'redirected' };
  },
};
