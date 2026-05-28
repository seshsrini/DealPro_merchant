import { supabase } from './supabaseClient';

// -----------------------------------------------------------------------------
// In-app Razorpay subscription checkout.
//
// Previously this opened the VedicJaalam /subscribe page in an external browser
// (Capacitor Browser / new tab) and waited for either a `dealpro://paid` deep
// link or a `dealpro:paid` postMessage to come back. That coupled the merchant
// flow to a Vercel-hosted Next.js page + Razorpay env vars on Vercel, and was
// unreliable across Android OEMs (Custom Tab sometimes opens system browser,
// deep links don't always reopen the app cleanly).
//
// The new flow keeps Vercel out of the payment path entirely:
//
//   1. Call Supabase Edge Function `create-subscription`
//        → reads tier from subscription_tiers (using server-side service role)
//        → calls Razorpay /v1/subscriptions with RAZORPAY_KEY_ID/SECRET
//          (which live ONLY on Supabase Functions secrets — never shipped)
//        → returns { subscription_id }.
//   2. Load Razorpay Checkout JS into the merchant app's own WebView.
//   3. Open Razorpay Checkout in-app — the user pays without leaving the app.
//   4. On success, call Supabase Edge Function `verify-subscription`
//        → HMAC-verifies the signature
//        → upserts a `pending_activation` row to merchant_subscriptions.
//   5. Dispatch a window 'dealpro:paid' CustomEvent so App.tsx starts polling
//      merchant_subscriptions for status='active' (the razorpay-webhook
//      function is still the source of truth that flips it to active).
//
// The only client-side env var needed is the (public) Razorpay key id:
//   VITE_RAZORPAY_KEY_ID=rzp_test_...
// -----------------------------------------------------------------------------

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  method?: { upi?: boolean; card?: boolean; netbanking?: boolean; wallet?: boolean };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

/** Idempotent — only fetches checkout.js once even on repeated checkout opens. */
let scriptPromise: Promise<void> | null = null;
function ensureRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null; // allow retry on the next open
      reject(new Error('Failed to load Razorpay Checkout script. Check your internet connection.'));
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export interface OpenCheckoutInput {
  tierKey: string;
  merchantId: string;
  withLoyalty?: boolean;
}

export interface OpenCheckoutResult {
  status: 'paid' | 'cancelled';
  razorpay_subscription_id?: string;
}

export const razorpayCheckoutService = {
  async openCheckout(input: OpenCheckoutInput): Promise<OpenCheckoutResult> {
    const keyId = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
    if (!keyId) {
      throw new Error('Razorpay key id missing — set VITE_RAZORPAY_KEY_ID in .env.local.');
    }

    // 1. Server-side: create the Razorpay subscription.
    const { data: createData, error: createErr } = await supabase.functions.invoke(
      'create-subscription',
      {
        body: {
          tier_key: input.tierKey,
          merchant_id: input.merchantId,
          loyalty: !!input.withLoyalty,
        },
      },
    );
    if (createErr) {
      throw new Error(createErr.message || 'Could not create subscription');
    }
    const subscriptionId: string | undefined = createData?.subscription_id;
    if (!subscriptionId) {
      throw new Error(createData?.error || 'Could not create subscription');
    }
    const tierName: string = createData?.tier?.tier_name || input.tierKey;

    // 2. Make sure Razorpay's Checkout JS is loaded.
    await ensureRazorpayScript();
    const Ctor = window.Razorpay;
    if (!Ctor) {
      throw new Error('Razorpay Checkout failed to load.');
    }

    // 3. Open the Checkout sheet right inside the app.
    return new Promise<OpenCheckoutResult>((resolve, reject) => {
      const rzp = new Ctor({
        key: keyId,
        subscription_id: subscriptionId,
        name: 'DealPro',
        description: tierName,
        // UPI first — card eMandate fails 15-30% on Indian banks.
        method: { upi: true, card: true, netbanking: true, wallet: false },
        theme: { color: '#f59e0b' },
        modal: {
          ondismiss: () => resolve({ status: 'cancelled' }),
        },
        handler: async (response) => {
          try {
            // 4. Server-side verify + write pending_activation row.
            const { data: verifyData, error: verifyErr } = await supabase.functions.invoke(
              'verify-subscription',
              {
                body: {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_subscription_id: response.razorpay_subscription_id,
                  razorpay_signature: response.razorpay_signature,
                  merchant_id: input.merchantId,
                  tier_key: input.tierKey,
                  loyalty: !!input.withLoyalty,
                },
              },
            );
            if (verifyErr || !verifyData?.success) {
              reject(new Error(verifyErr?.message || verifyData?.error || 'Payment verification failed'));
              return;
            }
            // 5. Tell App.tsx to start polling for active status. The webhook
            //    (razorpay-webhook) is what actually flips status='active'.
            window.dispatchEvent(
              new CustomEvent('dealpro:paid', {
                detail: { razorpay_subscription_id: response.razorpay_subscription_id },
              }),
            );
            resolve({
              status: 'paid',
              razorpay_subscription_id: response.razorpay_subscription_id,
            });
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
      });
      rzp.open();
    });
  },
};
