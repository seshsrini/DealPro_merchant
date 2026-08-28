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
