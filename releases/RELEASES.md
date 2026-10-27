# DealFynd for Business (Merchant) — Release Audit

Record of every release bundle built for `com.dealpro.merchant`.

The `.aab` files live in this folder but are **not** committed — they are ~22 MB
each and git keeps every version forever, so a year of releases would add
hundreds of megabytes to every clone, permanently and irreversibly. This file is
the committed audit trail; Google Play Console holds the authoritative copy of
every bundle ever uploaded.

Verify a bundle against its recorded hash before uploading:

```bash
node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))" releases/<file>.aab
```

`versionCode` is seconds since epoch, stamped at build time by
`android/app/build.gradle`; `versionName` is the same instant as a readable
timestamp. Both are therefore unique and monotonic per build.

---

## 2026.10.27.0851 — versionCode 1793105486

| | |
|---|---|
| File | `dealfynd-merchant-2026.10.27.0851-vc1793105486.aab` |
| SHA-256 | `881dd0a9be0dd6e78a636958db4cd96b4afbd8f6b322c2760e3c1de0eb27808c` |
| Size | 22,274,453 bytes |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`), SHA1 `32:7F:5C:…:FD:F5` |
| targetSdk / minSdk | 36 / 24 |
| Commit | `7b86e12` |
| Play status | pending upload |

Everything in `2026.10.26.2123` plus:

- **Business registration mandatory.** "None / Unregistered" removed; every merchant
  gives GSTIN, Udyam, FSSAI or Trade Licence. Merchants who signed up with "none"
  get a non-skippable "Business registration required" screen after login (before
  the subscription page), saved via `set-business-document`.
- **onboarding_complete only after every step.** The signup submit records step 9;
  the database sets complete + step 12 once profile, registration, Terms/Privacy
  and an active subscription are all in place.
- Server side (DEV + PROD 2026-10-27, before upload): set-business-document,
  complete-merchant-profile, patch-merchant-profile, create-campaign;
  `require_business_registration.sql` (campaign_create_gate.has_business_doc,
  onboarding guard triggers, row correction).

## 2026.10.26.2123 — versionCode 1793064196 — submitted to Play 2026-10-26; superseded by 2026.10.27.0851

| | |
|---|---|
| File | `dealfynd-merchant-2026.10.26.2123-vc1793064196.aab` |
| SHA-256 | `dc77fb4f4929680041b92e20dd441e7c3b2e119ec014adba7975a0c0e27891d5` |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / 24 |
| Commit | `960a6e1` |
| Play status | submitted 2026-10-26 (replace with 2026.10.27.0851) |

Everything in `2026.10.26.0818` plus:

- **Business logo.** Edit Profile → Store Information. Square-cropped on device,
  content-checked server-side by `set-merchant-logo` (Gemini, fails closed),
  stored at Cloudinary `dealpro-logos/merchant_<id>`, saved to
  `merchant_profiles.logo_url` (`add_merchant_logo.sql`). Owner only.
- **"Products" → "Products/Items"** across catalogue, product wizard, insights,
  notifications and templates, all 9 languages; AI assistant also understands "item".
- Login screen: small back button to the referral-code step.
- Server side (deployed DEV + PROD 2026-10-26, before upload): set-merchant-logo,
  get-smart-notifications, get-ai-insights-dashboard, get-ai-assistant-response,
  optimize-campaign, analyze-product-image, get-performance-score, get-ai-insights.

## 2026.10.26.0818 — versionCode 1793017098 — superseded by 2026.10.26.2123, do not upload

| | |
|---|---|
| File | `dealfynd-merchant-2026.10.26.0818-vc1793017098.aab` |
| SHA-256 | `fcea10d3127233351ac5184c017c677f901961348c916bb771c079ad582a53c7` |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / 24 |
| Commit | `c983296` |
| Play status | pending upload |

Everything in `2026.10.25.1030` (WhatsApp chat opt-in per store) plus:

- **Fix — "Selected store not found" when publishing a deal.** The deal and
  Deal-of-the-Day wizards could publish with a store id from a cached store list
  (fresh for 1 h) or a restored draft after the store had been re-created (signup
  re-submitted, or test data deleted and re-signed with the same phone). Wizards
  now load stores from the server, re-validate the selection (auto-selecting the
  only store, otherwise back to store choice), reload on that publish error, and
  signup clears the cached store list.
- Store WhatsApp hint shown in dark amber for readability.

## 2026.10.25.1030 — versionCode 1792938627 — superseded by 2026.10.26.0818, do not upload

| | |
|---|---|
| File | `dealfynd-merchant-2026.10.25.1030-vc1792938627.aab` |
| SHA-256 | `d9c356e68e9b5db2d45eebe3e1736fd649d4225ecdacf28a0b97e9131c546b04` |
| Size | 22,268,238 bytes |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / 24 |
| Commit | `8b6b470` |
| Play status | pending upload |

**WhatsApp chat opt-in per store.** The store phone is now "Store WhatsApp
Number" (with a hint). The signup Address step and "add store" in My Stores ask
"OK to receive WhatsApp messages from DealFynd customers on this number?"; each
store in My Stores has an on/off switch (turning on asks for consent) and a
"WhatsApp chat on" badge. QR Scan shows "only redeem a code at checkout". My
Stores phone labels are now translated. New labels in all 9 languages.

Server side already live (2026-10-25, DEV + PROD): migration
`add_store_whatsapp_chat.sql` (`merchant_stores.whatsapp_chat_enabled`,
`whatsapp_consent_at`); `manage-stores` (flag whitelisted, consent time set
server-side), `complete-merchant-profile` (per-store consent),
`create-claim` (deployed from this repo — returns the caller's own existing
code on a duplicate claim; merchant push + race handling kept).

## 2026.10.23.2022 — versionCode 1792801356

| | |
|---|---|
| File | `dealfynd-merchant-2026.10.23.2022-vc1792801356.aab` |
| SHA-256 | `3a5de00c640dd79fcf01e78823b7a7b4a16b2c495e8e9d970bb693a1ddb38759` |
| Size | 22,264,339 bytes |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / 24 |
| Commit | `bcde15a` |
| Play status | pending upload |

**Signup: each step saved, resume where you left off, strict gates.** Changes are
confined to the signup wizard (no login, gating, dashboard, subscription or store
code touched since `1032`).

- Each completed step is saved into `merchant_profiles` via the narrowed
  `patch-merchant-profile` (name, legal/store name, business document, plus
  `onboarding_step` / `onboarding_step_at`). Terms/privacy, stores and
  `onboarding_complete` remain final-submit-only, so an abandoned signup never
  looks complete and unfinished stores never reach consumers.
- The signup draft autosaves while typing (debounced 2 s) with the step the
  merchant is on; returning merchants land on that step with their input and a
  "Welcome back" banner. Autosave stops after the final submit.
- Store list "Continue" requires every store with an address to be complete;
  Review "Looks good" is disabled with a list of missing items (each links to its
  step); the final submit re-checks and returns to Review if anything is missing.
- New labels in all 9 languages.
- Server side already live (2026-10-23): `patch-merchant-profile` deployed to DEV
  and PROD (old clients never call it). Optional migration
  `add_onboarding_step_tracking.sql` adds the step columns; saves work without it.

## 2026.10.21.1032 — versionCode 1792593158

| | |
|---|---|
| File | `dealfynd-merchant-2026.10.21.1032-vc1792593158.aab` |
| SHA-256 | `76a0d23ec6201a0c2429fc267b995ebf4cd587360ef87321b05cf4d3fb7640a1` |
| Size | 22,261,722 bytes |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / **24** |
| Commit | `4a3c4ec` (code identical to `1714677`) |
| Play status | **approved — production (2026-10-21)** |

**Rebuild of 2026.10.21.0924 with a new versionCode** — Play refused a second
production upload of 1792589056 ("version code has already been used"). Same
code and settings.

**minSdk raised 23 → 24 (Android 7.0).** Play's automatic protection requires
minSdk 24+; `2026.10.21.0110` was rejected at upload for minSdk 23. Android 6.0
devices can no longer install or update.

**GST on subscriptions (18%).** Plans are now charged as base price + GST:
₹199 → ₹234.82, ₹399 → ₹470.82, ₹599 → ₹706.82 monthly; ₹1,990 → ₹2,348.20,
₹3,990 → ₹4,708.20, ₹5,990 → ₹7,068.20 yearly. Merchants with their first store
in Karnataka (supplier state) see CGST 9% + SGST 9%; other states see IGST 18%;
unknown state is treated as intra-state. The charge itself comes from new
GST-priced Razorpay plans linked on `subscription_tiers` — no client sends an
amount.

- **Payments & Invoices** shows each payment's breakup: plan price, GST 18%
  (CGST + SGST or IGST) and total paid, in 2-decimal INR (`PaymentPlans.tsx`,
  new `m_gst_*` keys in all 9 languages).
- The Play-compliant **My Subscription** view still shows no prices (unchanged,
  by design). The non-compliant price displays show the GST-inclusive total.
- Server side (deployed 2026-10-20/21, already live — not part of this bundle):
  `razorpay-webhook` writes the full breakup to `merchant_payments` (base, CGST,
  SGST, IGST, GST total, place of supply, SAC, plain GSTIN when verified) and the
  GST-inclusive recurring amount to `merchant_subscriptions`;
  `verify-subscription`, `merchant-subscription` and `get-merchant-payments`
  updated to match. Also shipped with those functions: yearly plans count the
  deal allowance over the full year, and the activation message says DealFynd.
- Requires `zzz_subscription_gst.sql` on the project (applied to PROD and DEV).

Not recorded here: bundles `2026.09.17.0739` and `2026.10.06.0652` were built
but have no entries; add them if they were uploaded to Play.

## 2026.10.21.0924 — versionCode 1792589056 — superseded

Accepted by Play (uploaded 2026-10-21), so its version code can't be uploaded
again; superseded for production by `2026.10.21.1032` (identical code).
SHA-256 `f82eba906849b1d53a0300973c5fd242c42d36196c04d3ef68d8929294c6d43d`, commit `1714677`, targetSdk 36 / minSdk 24.

## 2026.10.21.0110 — versionCode 1792559402 — REJECTED, do not upload

Rejected by Play at upload: "Play automatic protection requires a minimum SDK
version of 24 or higher" (minSdk was 23). Superseded by `2026.10.21.0924`, which
has identical app code. SHA-256 `28f77568fcc7a58392cbb3fc96d78d130aae0241c77de3ead3aca44f8b6c291f`, commit `b8c623f`.

## 2026.09.12.1838 — versionCode 1789252733

| | |
|---|---|
| File | `dealfynd-merchant-2026.09.12.1838-vc1789252733.aab` |
| SHA-256 | `1f86026ddec6d4246a920d4aa689ba212b5ce2ab83dedd6c24d1d8575f4ef8ed` |
| Size | 22,298,326 bytes |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / 23 |
| Commit | `8101537` |
| Play status | pending upload |

**Additional deal photos: price tag now baked at bottom-left, not top-left.**
`generatePriceTagImage` (used for the 2nd+ photos of a deal) drew its price pill
in the top-left corner while the cover photo's price band sits at the bottom, so a
multi-photo deal showed the price bottom-left on photo 1 and top-left on the rest.
The pill is now anchored bottom-left to match. It is baked into the image pixels
at publish time, so this affects **newly published deals only** — images already
uploaded keep their baked position.

---

## 2026.08.30.0702 — versionCode 1788087736

| | |
|---|---|
| File | `dealfynd-merchant-2026.08.30.0702-vc1788087736.aab` |
| SHA-256 | `f706406b7769a3d807117d88b620dc40fccb7380c83a9e76fee5c8a4657eab42` |
| Size | 22,298,181 bytes |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / 23 |
| Commit | `51e01ca` |
| Play status | pending upload |

**Hotfix for a regression shipped in 2026.08.29.1134**, same defect and same fix
as the consumer app. Testers were dropped into the app before entering the code
from their SMS.

That release made the `phoneVerificationCompleted` listener outlive
`phoneCodeSent`. `timeout: 0` suppresses SMS auto-retrieval but not **instant
verification** — Google verifying the device's own number — which fires the same
event and is unaffected by any timeout. The listener therefore completed real
sign-ins while the SMS was still arriving.

Not an authentication bypass: the plugin emits that event only after
`signInWithCredential` succeeds. Still the wrong behaviour.

Sign-in now completes from that event only when it arrives **before** the code
screen is shown. Afterwards it logs which variant fired and does nothing else.
`timeout: 0` stays, so the 2026.08.29 fix for rejected codes is unaffected. The
unreachable `onAutoVerified()` callback and its modal subscription are removed.

---

## 2026.08.29.1134 — versionCode 1788017667

| | |
|---|---|
| File | `dealfynd-merchant-2026.08.29.1134-vc1788017667.aab` |
| SHA-256 | `b8ee0c73e80189c64759cc78b9e618d74db9860a790013e58029e46ae98b65c6` |
| Size | 22,298,217 bytes |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / 23 |
| Commit | `bbb1af0` |
| Play status | pending upload |

Everything in 2026.08.29.1054 (which was never uploaded), plus:

**A second raw-error leak, in the OTP modal.** The earlier bundle still rendered
`OTP error: <code> <raw Firebase message>` to users on a failed send. The service
had been cleaned up but the modal kept its own copy of the same diagnostic.

**Removed the forgot-password screen and its `123456` bypass.** Orphaned here —
nothing imported it — but it still shipped in the bundle. It never sent an OTP:
it checked the identifier existed, accepted the literal `123456`, then called an
unauthenticated `reset-password` edge function that set the account's password
using the service role key. The app has no password concept; authentication is
phone + OTP. The screen, its `AppView` member, `editProfileService.resetPassword`
and the edge function source are gone. The deployed function was deleted from the
shared Supabase project separately — removing source does not undeploy it.

---

## 2026.08.29.1054 — versionCode 1788015252

| | |
|---|---|
| File | `dealfynd-merchant-2026.08.29.1054-vc1788015252.aab` |
| SHA-256 | `db9b2ec90448c3c6cb08847e846cab1fe140c28ca581c67d1757f97848aa4b70` |
| Size | 22,298,520 bytes |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / 23 |
| Commit | `8e25f30` |
| Play status | **superseded by 2026.08.29.1134 — never uploaded.** Its bundle
  still leaked raw Firebase errors from the OTP modal and carried the dead
  forgot-password screen. File deleted from this folder so it cannot be uploaded
  by mistake. |

**Fixes the same OTP failure found and fixed in the consumer app.** Merchant runs
the identical native phone-auth path; it went unnoticed only because every
merchant test used a Firebase test number, which sends no SMS — so real-number
OTP had no production evidence behind it.

`@capacitor-firebase/authentication` defaults `signInWithPhoneNumber` to
`timeout: 60`, leaving Android SMS auto-retrieval on. When it fires, the plugin
calls `signInWithCredential` immediately — redeeming the code server-side — and
only then emits `phoneVerificationCompleted`. `sendOtp()` removed that listener
inside the `phoneCodeSent` handler, so the app kept asking for a code the backend
had already spent and the user's entry returned 400 `INVALID_CODE`. Now passes
`timeout: 0` and keeps the auto-verification listener alive past `phoneCodeSent`.

Also drops the shipped `Send failed: ...` diagnostic that leaked raw Firebase
text to users, and corrects a stale comment naming project `dealpro-merchant`;
this app is on `dealpro-prod---m` (376667169728).

**Also enabled server-side, no bundle change:** Play Integrity API on
`dealpro-prod---m`. It was disabled.

---

## 2026.08.28.1834 — versionCode 1787956486

| | |
|---|---|
| File | `dealfynd-merchant-2026.08.28.1834-vc1787956486.aab` |
| SHA-256 | `a964622ba4484619148ecdd2e8943f22f0e2734d013b90cb4e0b1dc72899eb19` |
| Size | 22,298,351 bytes |
| Signing key | `CN=DealPro, OU=Mobile, O=DealPro, C=IN` (alias `dealpro-merchant`) |
| targetSdk / minSdk | 36 / 23 |
| Commit | `d658ca4` |
| Play status | pending upload |

**Target Android 16 (API 36).** Required by Play from 31 Aug 2026; below that,
updates to a published app are blocked. Carries two compatibility opt-outs, both
temporary:

- `enableOnBackInvokedCallback="false"` — predictive back defaults on at
  targetSdk 36 and abandons the legacy `onBackPressed` path that Capacitor 6's
  `backButton` listener depends on. Remove during a Capacitor 7 upgrade.
- `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` — keeps the portrait lock on
  large screens. **Stops working at targetSdk 37**, so landscape support is due
  before the next target-API deadline.

**Removed the hardcoded test-number OTP bypass.** Nine numbers accepting a fixed
`123456` were compiled into the shipped JavaScript. Reviewer access moved to
Firebase Console → Authentication → Phone → "Phone numbers for testing".

**Test-subscription button gated to reviewer accounts only.** Previously shown
whenever `VITE_ALLOW_TEST_SUBSCRIPTION` was true, which exposed a free
subscription to every merchant in any build where the flag was left on. That
clause is gone; the button now requires an allow-listed phone, and
`merchant-subscription` enforces the same list server-side.

**Referral links repaired.** Invites pointed at `dealpro.app`, which serves no
signup page. Now the Play listing.

> **Review access — remove after approval.** Three numbers are configured in
> Firebase Auth with a fixed verification code, listed in `VITE_REVIEWER_PHONES`,
> and set as the `REVIEWER_PHONES` Supabase secret. The numbers are inlined in
> the client bundle; that is safe **only** because the verification code lives in
> Firebase and never in this repo, so an extracted number cannot be
> authenticated as. Delete the Firebase numbers and unset the secret once review
> completes — both are console actions needing no release.
