import { Browser } from '@capacitor/browser';

// -----------------------------------------------------------------------------
// Subscription checkout — REDIRECT to the VedicJaalam web page (Play-compliant).
//
// Google Play does not allow third-party payment (Razorpay) for subscriptions
// *inside* the app, so payment happens on the web instead:
//
//   1. The app opens vedicjaalam.com/subscribe?tier_key=…&merchant_id=…&loyalty=…
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

export interface OpenCheckoutInput {
  tierKey: string;
  merchantId: string;
  withLoyalty?: boolean;
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
      loyalty: input.withLoyalty ? '1' : '0',
    });
    const url = `${SUBSCRIBE_URL}?${params.toString()}`;
    console.log('[razorpayCheckout] Opening Play-compliant web checkout:', url);
    await Browser.open({ url });
    // Result is asynchronous: the merchant pays on the web page and returns via
    // the dealpro://paid deep link, which App.tsx handles (polls for 'active').
    return { status: 'redirected' };
  },
};
