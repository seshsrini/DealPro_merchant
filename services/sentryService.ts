// ────────────────────────────────────────────────────────────────────────
// Sentry integration — error reporting + (optionally) performance + replay.
//
// Designed as a thin wrapper so the rest of the codebase never imports
// @sentry/react directly. That gives us:
//
//   • Drop-in safety: the @sentry/react package is loaded via DYNAMIC import.
//     If the package isn't installed (yet), or if `VITE_SENTRY_DSN` isn't set,
//     every helper here becomes a silent no-op. The app continues to work
//     normally — just without Sentry visibility.
//
//   • One place to swap the vendor: if you ever migrate from Sentry to
//     LogRocket / PostHog / Bugsnag, only this file changes.
//
// Setup (one-time, see docs/SENTRY_SETUP.md):
//   1. `npm install @sentry/react`
//   2. Sign up at sentry.io, create a React project, copy the DSN.
//   3. Add `VITE_SENTRY_DSN=<dsn>` to your .env.local.
//   4. Done — every uncaught error and ErrorBoundary trip starts flowing to Sentry.
// ────────────────────────────────────────────────────────────────────────

// We can't import the type safely if the package may be missing, so the
// reference is `any`. The wrapper functions handle the absence gracefully.
let SentryModule: any = null;

const env = (import.meta as any).env || {};
const DSN: string | undefined = env.VITE_SENTRY_DSN;
const RELEASE: string = env.VITE_SENTRY_RELEASE || 'merchant@unknown';
const ENVIRONMENT: string = env.MODE || 'production';

/**
 * Initialize Sentry. Call once at app startup, before React renders.
 * No-op if VITE_SENTRY_DSN is unset or @sentry/react isn't installed.
 */
export const initSentry = async (): Promise<void> => {
  if (!DSN) {
    console.log('[Sentry] No VITE_SENTRY_DSN configured — error reporting disabled.');
    return;
  }
  try {
    // Vite's static analyzer would try to resolve '@sentry/react' at build time
    // and fail if the package isn't installed yet. Routing the path through a
    // variable + @vite-ignore hint makes the import truly runtime-only, so the
    // build succeeds without the package and only fails (silently, in catch) at
    // runtime if it's actually called and missing.
    const moduleName = '@sentry/react';
    SentryModule = await import(/* @vite-ignore */ moduleName);
    SentryModule.init({
      dsn: DSN,
      environment: ENVIRONMENT,
      release: RELEASE,
      // Performance & replay are heavier; opt in via dashboard later if wanted.
      tracesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      // Keep errors-only for v1 — minimizes Sentry quota burn.
      // Don't send breadcrumbs from console.log in dev to keep dev clean.
      beforeBreadcrumb: (breadcrumb: any) => {
        if (ENVIRONMENT === 'development' && breadcrumb?.category === 'console') return null;
        return breadcrumb;
      },
    });
    console.log(`[Sentry] Initialized (env=${ENVIRONMENT}, release=${RELEASE})`);
  } catch (err) {
    console.warn('[Sentry] Init failed (package missing or DSN invalid):', err);
  }
};

/**
 * Report an exception. Safe to call anywhere — no-ops if Sentry isn't loaded.
 * Pass `extra` to attach context (component name, user action, IDs, etc.).
 */
export const captureException = (error: unknown, extra?: Record<string, any>): void => {
  if (!SentryModule) return;
  try {
    SentryModule.captureException(error, extra ? { extra } : undefined);
  } catch { /* never throw from a logger */ }
};

/**
 * Report a non-error message (e.g. unexpected state, fallback path taken).
 * Lower priority than captureException; use sparingly.
 */
export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info'): void => {
  if (!SentryModule) return;
  try {
    SentryModule.captureMessage(message, level);
  } catch { /* noop */ }
};

/**
 * Tag the current Sentry session with user identity. Call on login + clear on logout.
 * Pass `null` to clear.
 */
export const setSentryUser = (user: { id?: string; email?: string; phone?: string } | null): void => {
  if (!SentryModule) return;
  try {
    if (user && user.id) {
      SentryModule.setUser({
        id: user.id,
        email: user.email,
        // 'username' is the Sentry-canonical handle; phone goes there since we
        // don't always have email for OTP-only users.
        username: user.phone || user.email,
      });
    } else {
      SentryModule.setUser(null);
    }
  } catch { /* noop */ }
};

/**
 * Add a breadcrumb to the next error report. Useful for tracking user actions
 * leading up to a crash (e.g. "tapped Publish", "uploaded image", "switched store").
 */
export const addBreadcrumb = (message: string, category: string = 'app', data?: Record<string, any>): void => {
  if (!SentryModule) return;
  try {
    SentryModule.addBreadcrumb({ message, category, data, level: 'info' });
  } catch { /* noop */ }
};
