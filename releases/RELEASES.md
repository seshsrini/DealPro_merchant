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
