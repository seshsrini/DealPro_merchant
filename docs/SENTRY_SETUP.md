# Sentry — error reporting setup

The app is wired for Sentry but it's a **no-op until you install the package and set a DSN**. Two reasons for that:
1. You can ship and test all the integration code without paying for Sentry yet.
2. If Sentry's CDN ever goes down, the app keeps working — failures are silent.

This guide walks through getting both apps reporting errors, end to end (~15 min).

---

## 1. Create a Sentry account + projects (~5 min)

1. Sign up at [sentry.io](https://sentry.io) — the free tier covers ~5k events/month, plenty for early validation.
2. Create **two projects** (one for each app):
   - Project type: **React**
   - Names: e.g. `dealpro-merchant` and `dealpro-consumer`.
3. After creation, Sentry shows a DSN per project — looks like:
   ```
   https://abc123def456@o0000000.ingest.us.sentry.io/0000000
   ```
   Copy each. You'll need them in step 3.

---

## 2. Install the package (~1 min each)

In the merchant app:
```bash
cd c:/Srini/dealpro/MerchantDEV/dealpro
npm install @sentry/react
```

In the consumer app:
```bash
cd c:/Srini/dealpro/dev/dealpro
npm install @sentry/react
```

The wrapper in `services/sentryService.ts` uses `await import('@sentry/react')` so the build still succeeds without the package — but until installed, `initSentry()` will warn and bail out.

---

## 3. Add the DSN to each app's environment

**Merchant** — add to `c:/Srini/dealpro/MerchantDEV/dealpro/.env.local`:
```
VITE_SENTRY_DSN=<merchant-project-dsn-from-step-1>
VITE_SENTRY_RELEASE=merchant@1.0.0
```

**Consumer** — add to `c:/Srini/dealpro/dev/dealpro/.env.local`:
```
VITE_SENTRY_DSN=<consumer-project-dsn-from-step-1>
VITE_SENTRY_RELEASE=consumer@1.0.0
```

The `VITE_SENTRY_RELEASE` tag is what shows up in Sentry's "Release" filter — bump the version when you ship a new build so you can tell which version a crash came from.

---

## 4. Verify the wiring (~3 min)

Restart the dev server in each app:
```bash
npm run dev
```

In the browser console you should see:
```
[Sentry] Initialized (env=development, release=merchant@1.0.0)
```

If you see this instead, something's wrong:
```
[Sentry] No VITE_SENTRY_DSN configured — error reporting disabled.
```
→ DSN env var didn't load. Confirm `.env.local` is in the right folder, restart dev server, and that the variable name starts with `VITE_` (Vite only exposes those to client code).

```
[Sentry] Init failed (package missing or DSN invalid): ...
```
→ Run `npm install @sentry/react` in that app's folder.

---

## 5. Trigger a test error

In any component (e.g. a button onClick), temporarily add:
```ts
throw new Error('Sentry test — please ignore');
```

Click → the ErrorBoundary fallback appears → check Sentry dashboard within ~30 seconds. The error should appear under **Issues** with:
- Full stack trace
- Component stack
- User identity (if you were logged in — comes from `setSentryUser` in App.tsx)
- Environment, release, browser info

Remove the test `throw` after verifying.

---

## What's already wired

You don't need to touch the code below — it's done:

- **`services/sentryService.ts`** in both apps — wrapper with `initSentry`, `captureException`, `captureMessage`, `setSentryUser`, `addBreadcrumb`.
- **`index.tsx`** in both apps — calls `initSentry()` before React renders so even errors during initial mount are captured.
- **`components/ErrorBoundary.tsx`** in both apps — `componentDidCatch` forwards to `captureException` with the component stack as `extra`.
- **`App.tsx`** in both apps — `setSentryUser` runs whenever auth state changes, so reported errors are always attributed to the right merchant/consumer (or anonymous when logged out).

---

## What you can do later (optional)

These are dashboard-side tweaks, not code changes:

- **Slack / email alerts** — Sentry → Project Settings → Alerts → set rules like "alert me if any new issue affects > 5 users in 1 hour."
- **Session Replay** — Sentry → Project Settings → Replays → enable. (We left `replaysSessionSampleRate: 0` in code; bump that if you want them.)
- **Performance tracing** — Sentry → Project Settings → Performance. (`tracesSampleRate: 0` currently; bump to e.g. 0.1 to sample 10% of page loads.)
- **Source maps** — for nicer stack traces, upload Vite's source maps via the Sentry CLI on each build. Sentry's docs walk through it.

For now, bare-bones errors-only is the fastest signal — you'll be flooded with new visibility in the first week and can choose what to enable next based on what you actually see.

---

## Adding breadcrumbs (improves error context)

The wrapper exposes `addBreadcrumb` — drop these at user actions you'd want to see in any subsequent error report:

```ts
import { addBreadcrumb } from './services/sentryService';

// In the publish button click handler:
addBreadcrumb('Tapped Publish', 'wizard', { dealId: state.dealId, kind: 'regular' });
```

When an error fires later, Sentry shows the recent breadcrumbs as a timeline — invaluable for "what was the user doing when this broke?" debugging.

Don't go crazy — 5–10 breadcrumbs per session is plenty. Most useful spots:
- Login / logout
- Wizard step transitions
- Publish / Save / Delete actions
- Network call retries
