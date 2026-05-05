# DealPro — Manual Test Plan

> Tester-facing test plan for both DealPro apps (Merchant + Consumer).
> Each section gives baby-step instructions for happy paths + negative scenarios.
>
> **Status:** Living document. Sections will be added incrementally.
> **Last updated:** 2026-04-30

---

## How to use this document

- Each test case has a unique **ID** (e.g. `M-AUTH-01`) for tracking in your bug tracker.
- **Pre-conditions** must all be true before starting the steps.
- **Steps** are numbered baby steps — each step does ONE thing.
- **Expected result** is what the tester should observe after completing the steps.
- **Pass / Fail** is filled by the tester at execution time.
- **Notes / Bug ID** is for any deviation from expected, with a link to the tracker ticket.

### ID prefix legend
| Prefix | Area |
|---|---|
| `M-AUTH` | Merchant Authentication |
| `M-ONB`  | Merchant Onboarding |
| `M-DEAL` | Merchant Regular Deal Wizard |
| `M-DOTD` | Merchant Deal of the Day Wizard |
| `M-BGF`  | Merchant Buy & Get Free Mode |
| `M-PROD` | Merchant Product Catalogue |
| `M-STOR` | Merchant Stores Management |
| `M-DASH` | Merchant Dashboard / Analytics |
| `M-CAMP` | Merchant My Campaigns |
| `M-SUB`  | Merchant Subscriptions |
| `M-PROF` | Merchant Profile / Settings |
| `M-STAFF`| Merchant Staff / Team |
| `C-AUTH` | Consumer Authentication |
| `C-LOC`  | Consumer Location |
| `C-HOME` | Consumer Deals Browse |
| `C-DET`  | Consumer Deal Details |
| `C-RDM`  | Consumer Redemption / QR |
| `C-FAV`  | Consumer Favorites / Pinned |
| `C-PROF` | Consumer Profile |
| `C-CAT`  | Consumer Merchant Catalogue View |

### Severity legend (for bugs you log)
- **S1 — Blocker:** prevents core flow (publish, redeem, login).
- **S2 — Major:** feature broken but workaround exists.
- **S3 — Minor:** cosmetic, copy, layout drift.
- **S4 — Trivial:** typo, alignment by 1px.

---

## Test environment setup

Before starting any test cycle, make sure the environment is ready.

1. **Devices:** test on at least one Android phone, one iOS phone, and one desktop browser (Chrome). For mobile-only flows (camera, biometric, deep links), an emulator is acceptable but a real device is preferred.
2. **Accounts:** maintain at least three working test accounts:
   - 1 merchant on **trial** plan, 1 merchant on **paid** plan, 1 merchant on **expired** plan.
   - 1 consumer with no claims yet, 1 consumer with active claims, 1 consumer with redemption history.
3. **Network:** be able to toggle network conditions (Chrome DevTools → Network → Throttling). Tests will reference this for offline / slow-network scenarios.
4. **Test data reset:** after a regression cycle, ask backend admin to reset test merchant deals/products if you've created many.
5. **Browser:** clear localStorage (DevTools → Application → Storage → Clear site data) between major test runs to avoid cached state masking bugs.
6. **Screenshots:** take a screenshot of any failure and attach to the bug ticket.

---

## Table of Contents

1. [Merchant — Authentication](#1-merchant--authentication)
2. [Merchant — Onboarding](#2-merchant--onboarding)
3. [Merchant — Create Regular Deal](#3-merchant--create-regular-deal)
4. *(coming next)* Merchant — Create Deal of the Day
5. *(coming next)* Merchant — Buy & Get Free mode
6. *(coming next)* Merchant — Stores Management
7. *(coming next)* Merchant — Product Catalogue
8. *(coming next)* Merchant — Dashboard / Analytics
9. *(coming next)* Merchant — My Campaigns
10. *(coming next)* Merchant — Subscriptions
11. *(coming next)* Merchant — Profile / Staff
12. *(coming next)* Consumer — Authentication
13. *(coming next)* Consumer — Location
14. *(coming next)* Consumer — Deals Browse
15. *(coming next)* Consumer — Deal Details + Redemption
16. *(coming next)* Consumer — Favorites / Pinned
17. *(coming next)* Consumer — Profile

---

## 1. Merchant — Authentication

### Happy path

#### M-AUTH-01: New merchant signup with phone number
**Pre-conditions:**
- App freshly installed OR localStorage cleared.
- Phone number not already registered as a merchant or consumer.
- Phone has SMS reception.

**Steps:**
1. Open the merchant app.
2. On the landing screen, tap **Sign up as Merchant**.
3. Tap the country-code selector and pick `+91` (India).
4. Type a valid 10-digit Indian mobile number.
5. Tap **Send OTP**.
6. Wait for the SMS (typically 5–30 seconds).
7. Enter the 6-digit OTP into the input box.
8. Tap **Verify**.

**Expected result:**
- Step 5 shows a "OTP sent" toast and the OTP entry screen.
- Step 8 navigates to the merchant onboarding wizard (Profile step).
- A merchant row exists in the database for this phone number.

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

#### M-AUTH-02: Existing merchant login via phone + OTP
**Pre-conditions:** A merchant account exists for the phone number.

**Steps:**
1. Open the merchant app on a fresh install (no saved session).
2. Tap **Login**.
3. Enter the registered phone number.
4. Tap **Send OTP**, wait for SMS.
5. Enter the OTP and tap **Verify**.

**Expected result:**
- Lands directly on the merchant dashboard (skips onboarding).
- Subscription status, store list, and deal counters load within 3 seconds.

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

#### M-AUTH-03: Login with biometric (returning device)
**Pre-conditions:**
- M-AUTH-02 succeeded once on this device.
- Device biometric (fingerprint / Face ID) is set up at OS level.
- App was previously logged out via **Logout** (not data-cleared).

**Steps:**
1. Open the merchant app.
2. On the landing screen, observe the **Use Biometric** prompt.
3. Tap **Use Biometric**.
4. Authenticate with fingerprint or face.

**Expected result:**
- Lands on the merchant dashboard within 2 seconds, no OTP needed.
- The session is restored from local biometric storage.

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

### Negative scenarios

#### M-AUTH-NEG-01: Signup with an invalid phone number
**Steps:**
1. Open the merchant app, tap **Sign up as Merchant**.
2. Enter `1234` (too short) and tap **Send OTP**.

**Expected result:**
- Inline validation error: "Enter a valid 10-digit number" (or equivalent).
- **Send OTP** button does not fire any network request.

#### M-AUTH-NEG-02: Signup with an already-registered number
**Steps:**
1. Tap **Sign up as Merchant**.
2. Enter a phone number that is already a merchant.
3. Tap **Send OTP** and complete OTP entry.

**Expected result:**
- After OTP verification, system either logs the user in (if merchant) OR shows an error like "This number is already registered. Please log in."
- No duplicate merchant row is created.

#### M-AUTH-NEG-03: Wrong OTP — 3 attempts
**Steps:**
1. Start signup or login flow up to OTP entry.
2. Enter `000000` (wrong). Tap **Verify**.
3. Repeat with another wrong OTP, twice more.

**Expected result:**
- Each wrong attempt shows an error: "Invalid OTP, please try again."
- After 3 wrong attempts, **Verify** disables and shows: "Too many attempts. Please request a new OTP."
- Tapping **Resend OTP** restarts the count.

#### M-AUTH-NEG-04: OTP expiry
**Steps:**
1. Start signup, request OTP.
2. Wait > 10 minutes (or whatever the configured TTL is).
3. Enter the now-stale OTP and tap **Verify**.

**Expected result:**
- Error: "OTP expired, please request a new one."
- Resend works and produces a fresh OTP.

#### M-AUTH-NEG-05: SMS never arrives
**Steps:**
1. Start signup.
2. Request OTP for a number that's known to have SMS issues OR airplane-mode the phone.
3. Wait 30 seconds.

**Expected result:**
- A **Resend OTP** action is available (button enabled or countdown timer reaches zero).
- Resending makes another attempt; UI does not lock the tester out indefinitely.

#### M-AUTH-NEG-06: Login with no internet
**Steps:**
1. Turn off Wi-Fi and mobile data on device.
2. Open the merchant app, attempt to log in.

**Expected result:**
- Clear error toast: "No internet connection. Please check your network."
- App does not crash or hang on a spinner indefinitely.
- Re-enabling network and retrying succeeds.

#### M-AUTH-NEG-07: Biometric mismatch / cancelled
**Pre-conditions:** Same as M-AUTH-03.

**Steps:**
1. Tap **Use Biometric**.
2. Provide a wrong fingerprint OR cancel the biometric prompt.

**Expected result:**
- App returns to the landing screen, does NOT log the user in.
- Optional: a tip appears to use OTP login instead.

#### M-AUTH-NEG-08: Session expired on cold open
**Pre-conditions:** Logged in 30+ days ago, app cold-started today.

**Steps:**
1. Open the app from a cold start.

**Expected result:**
- Either: app silently re-authenticates via cached phone (fast, transparent to user), OR
- Lands on the login screen with a polite "Please log in again" message.
- Does NOT show generic crash / blank screen.

---

## 2. Merchant — Onboarding

The onboarding wizard runs immediately after signup. It collects merchant profile, primary store, business category, and optional staff invites.

### Happy path

#### M-ONB-01: Complete onboarding end-to-end with one store
**Pre-conditions:** M-AUTH-01 just completed (fresh signup).

**Steps:**
1. On **Profile** step, enter Full Name, Email (optional), and tap **Next**.
2. On **Business** step, select a business category from the dropdown.
3. Optionally enter GSTIN, otherwise tap **Skip**.
4. Tap **Next** to reach **Add Your First Store**.
5. Enter Store Name.
6. Tap **Use my current location** (allow OS permission prompt).
7. Wait for address auto-fill (~1–3 seconds).
8. Verify Address, City, State, Pincode, Landmark are pre-filled. Edit any field that's wrong.
9. Tap **Next** to reach **Store Hours / Delivery / Phone**.
10. Pick store hours (Opens / Closes), enter store phone, optionally toggle **We deliver to customers** and select a range.
11. Tap **Save Store**.
12. On **Add More Stores?** screen, tap **Skip — I'm done** (or **Add another** to test M-ONB-02).
13. On **Welcome** screen, tap **Go to Dashboard**.

**Expected result:**
- Each step's **Next** button is disabled until required fields are filled.
- Step 7 successfully fetches GPS and reverse-geocodes the address (verify lat/lng appear in dev console or DB).
- Step 11 saves the store; verify the store appears in **Profile → My Stores** later.
- Step 13 lands on the merchant dashboard.

#### M-ONB-02: Add multiple stores during onboarding
**Pre-conditions:** Mid-onboarding at the **Add More Stores?** screen, with paid plan that allows multi-store.

**Steps:**
1. Tap **Add another store**.
2. Repeat steps 5–11 from M-ONB-01 with a different address.
3. Continue until you've added 3 stores.
4. Tap **Skip — I'm done**.

**Expected result:**
- All 3 stores appear in **Profile → My Stores**.
- Each store has correct address, phone, hours.

### Negative scenarios

#### M-ONB-NEG-01: Try to skip required Profile fields
**Steps:**
1. On **Profile** step, leave Full Name empty.
2. Tap **Next**.

**Expected result:**
- **Next** is either disabled OR tapping it shows a validation error pointing to Full Name.

#### M-ONB-NEG-02: GPS permission denied
**Steps:**
1. On the **Add Store** address step, tap **Use my current location**.
2. When the OS permission prompt appears, tap **Deny**.

**Expected result:**
- App shows a clear message: "Location permission needed to auto-fill address. You can also enter the address manually below."
- Manual address entry still works; the merchant can complete onboarding.

#### M-ONB-NEG-03: Invalid pincode
**Steps:**
1. On the address step, manually enter an invalid pincode like `99999` or `abc`.
2. Tap **Next**.

**Expected result:**
- Inline error on Pincode field. **Next** does not advance.

#### M-ONB-NEG-04: Submit store with invalid phone
**Steps:**
1. On the **Phone / Hours** step, enter a 5-digit phone number.
2. Tap **Save Store**.

**Expected result:**
- Validation error on phone field. Save is blocked.

#### M-ONB-NEG-05: Network failure during store save
**Steps:**
1. Fill the store form completely.
2. Turn OFF the network.
3. Tap **Save Store**.

**Expected result:**
- Spinner runs, then a clear error: "Could not save store. Please check your network and try again."
- Form data is preserved; merchant can retry without re-entering.

#### M-ONB-NEG-06: Free plan trying to add multiple stores
**Pre-conditions:** Merchant on a single-store-only plan.

**Steps:**
1. Complete first store.
2. On **Add More Stores?** tap **Add another**.

**Expected result:**
- Either the **Add another** button is disabled with a "Upgrade to add more stores" hint, OR tapping it opens an upgrade prompt.

---

## 3. Merchant — Create Regular Deal

This is the longest and most-tested flow. Wizard order:
**Store → Template → Image → Heading → Offer → Description → Badges → Layout → Start Date → End Date → Review → Publish.**

### Happy path

#### M-DEAL-01: Create + publish a regular deal end-to-end
**Pre-conditions:**
- Logged in merchant on an active plan with quota remaining.
- At least one store created.
- A clean product photo (jpg/png, no watermarks, no other-site UI).

**Steps:**
1. From Dashboard, tap the **+** floating action button → **New Deal**.
2. **Store step:** select your store from the dropdown. Tap **Next**.
3. **Template step:** tap **Skip — start from scratch** (or pick a template to test M-DEAL-02).
4. **Image step:**
   1. Tap **Upload from device**, pick the clean photo.
   2. Wait for the upload-time check spinner. It runs profanity + copyright AI in parallel.
   3. Verify the photo appears as the cover thumbnail with a blue "Cover" badge.
   4. Tap **Continue**.
5. **Heading step:** enter a deal title (e.g. "Festival Special: 30% Off"). Tap **Next**.
6. **Offer step:** enter offer text (e.g. "30% off all jeans"). Tap **Next**.
7. **Description step:** enter at least 50 characters of description. Tap **Next**.
8. **Trust badges step:** select 2–4 badges (e.g. Premium Quality, Free Delivery). Tap **Next**.
9. **Layout step:**
   1. Wait for the 5 banner previews (Auto / Left / Right / Top / Bottom) to bake.
   2. Verify each preview shows the photo with the heading + offer + badges baked in at the indicated position.
   3. Tap **Auto** (or whichever placement looks best).
   4. Tap **Continue**.
10. **Start Date:** pick today or a future date. Tap **Next**.
11. **End Date:** pick a date at least 1 day after Start. Tap **Next**.
12. **Review step:**
    1. Verify the consumer-style preview at the top shows your deal (cover banner, store name, heading, offer, dates).
    2. Verify the editable section list shows Store, Media, Heading, Offer, Description, Start, End.
    3. Verify the campaign-score panel renders within 5 seconds.
13. Tap **Publish Campaign**.
14. Watch the 3-step progress modal: Checking content → Uploading media → Publishing deal.

**Expected result:**
- Step 4.2 either passes (photo passes both checks) or — if the photo is rejected — see M-DEAL-NEG-04.
- Step 9 generates all 5 previews within ~1 second.
- Step 13 succeeds and lands on a success screen.
- The deal appears in **My Campaigns → Active**.
- Deal is visible to a consumer in the same city within 30 seconds.

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

#### M-DEAL-02: Create deal from a template
**Pre-conditions:** At least one saved template exists for the merchant.

**Steps:**
1. Tap **+ → New Deal**.
2. Select store. Tap **Next**.
3. **Template step:** tap a saved template card.
4. Verify the wizard pre-fills heading, offer, description, badges from the template.
5. Edit any field as needed.
6. Continue through remaining steps and publish.

**Expected result:**
- Pre-filled fields are editable.
- Publishing creates a NEW deal (does not overwrite the template).

---

#### M-DEAL-03: Upload multiple images, tag one with discount
**Steps:**
1. On **Image step**, upload 3 product photos one after another.
2. Wait for upload-time checks; verify all three appear with the first marked **Cover**.
3. On the 2nd image thumbnail, tap the **Tag** button (bottom right of thumbnail).
4. Enter Discount % = `30`, Offer Price = `699`.
5. Verify the green **Edit** state on the tag button.
6. Tap **Continue** — wait for upload-time checks.
7. Continue through wizard to **Review**.

**Expected result:**
- The 2nd image's tag info ("30% OFF" + "₹699") gets baked into a banner (visible in the consumer preview carousel).
- MRP `₹908` (auto = 1.3×offerPrice) appears with strikethrough.

---

#### M-DEAL-04: Save current draft + reopen later
**Steps:**
1. Start a new deal, fill several steps (Store, Image, Heading).
2. Tap the **X** close button.
3. Confirm "Keep draft" if prompted.
4. Reopen **+ → New Deal** later.

**Expected result:**
- Draft restoration: the saved heading is restored, and you land on the step you left from.
- Note: the cover image File is NOT restored (file objects can't be persisted). The wizard prompts for re-upload.

---

#### M-DEAL-05: Edit an existing published deal
**Pre-conditions:** A published deal exists, less than 2 hours since `created_at`.

**Steps:**
1. **My Campaigns → Active** → tap the deal.
2. Tap **Edit** in the deal preview.
3. Modify the heading.
4. Continue through the wizard to Review.
5. Tap **Update Campaign**.

**Expected result:**
- Wizard pre-fills all fields from the published deal.
- Update succeeds; consumer sees the new heading on next refresh.

---

### Negative scenarios

#### M-DEAL-NEG-01: Try to publish without a store
**Steps:**
1. Start a new deal but don't pick a store on the Store step.
2. Try to tap **Next**.

**Expected result:** **Next** is disabled until a store is selected.

#### M-DEAL-NEG-02: Heading too short
**Steps:**
1. On Heading step, enter "ab".
2. Tap **Next**.

**Expected result:** Validation error: "Heading must be at least 5 characters" (or whatever the minimum is). Cannot advance.

#### M-DEAL-NEG-03: Profane heading
**Steps:**
1. Enter a heading containing profanity (e.g. an offensive English word OR a transliterated Hindi slang like "BC").
2. Walk through the wizard and tap **Publish**.

**Expected result:**
- At Publish, content moderation flags the heading.
- The error message names the field that was flagged.
- Publication is blocked until the heading is fixed.

#### M-DEAL-NEG-04: Upload a watermarked / scraped image
**Steps:**
1. On Image step, upload an Amazon screenshot OR a Shutterstock-watermarked photo.
2. Wait for upload-time checks.

**Expected result:**
- The flagged image is **automatically removed** from the upload list.
- Error message names which check failed (profanity vs copyright) and the AI's reason.
- If 3 images uploaded and one is flagged, only the flagged one is removed; the other 2 remain.
- Cover gets promoted to the next surviving image if the original cover was the flagged one.

#### M-DEAL-NEG-05: Re-upload the same flagged image
**Steps:**
1. Trigger M-DEAL-NEG-04 — image is rejected.
2. Upload the **exact same file** again.

**Expected result:**
- Verdict is identical (still rejected) and **instant** — the upload-time cache should hit and skip the AI call entirely. Look for `[checkImageCopyright] Cache hit` in console.

#### M-DEAL-NEG-06: Image upload over the 5-image limit
**Steps:**
1. Upload 5 images successfully.
2. Try to add a 6th.

**Expected result:** **Add** button is hidden or disabled. A counter shows "5/5".

#### M-DEAL-NEG-07: Video over size limit
**Steps:**
1. On Image step, tap **Add Video** and pick a video > 50MB.

**Expected result:** Inline error "Video must be under 50MB". File is not added.

#### M-DEAL-NEG-08: End date before Start date
**Steps:**
1. Set Start Date = a week from today.
2. Set End Date = today.
3. Tap **Next**.

**Expected result:** End date validation blocks **Next** with: "End date must be after start date."

#### M-DEAL-NEG-09: Try to publish with no images
**Steps:**
1. Start a deal, skip past Image step (if possible — likely the wizard blocks this).

**Expected result:** Cannot proceed past Image step without at least one image. **Continue** is disabled.

#### M-DEAL-NEG-10: Session expires mid-wizard
**Steps:**
1. Start a deal, fill several steps.
2. Wait > 1 hour without any user activity (or use DevTools to manipulate localStorage to expire JWT).
3. Tap **Publish**.

**Expected result:**
- The wizard's 4-minute heartbeat should have refreshed the JWT silently — publish should still succeed.
- If the heartbeat failed somehow and a 401 hits at publish, the system retries via refreshSession before showing "Session expired."

#### M-DEAL-NEG-11: Quota exhausted
**Pre-conditions:** Merchant on a plan with `max_campaigns_per_month = 5`, already published 5 this month.

**Steps:**
1. Tap **+ → New Deal**.

**Expected result:** Either the **+** button shows a quota-exhausted state with an upgrade prompt, OR the wizard opens but blocks at Publish with a "Upgrade plan" CTA.

#### M-DEAL-NEG-12: Trial expired merchant trying to publish
**Pre-conditions:** Merchant whose trial ended 1 day ago, no paid subscription.

**Steps:** Same as M-DEAL-01.

**Expected result:** Publish blocked with "Trial expired. Please subscribe to continue publishing deals."

#### M-DEAL-NEG-13: Network drop during image upload
**Steps:**
1. Reach Review and tap **Publish**.
2. As soon as "Uploading media…" appears, kill the network.

**Expected result:**
- Upload retries the failed image once, then surfaces an error: "Image upload failed. Please go back and re-select your image."
- Wizard does not advance to a half-published state.

#### M-DEAL-NEG-14: Tap Publish twice rapidly
**Steps:** On Review, double-tap **Publish Campaign**.

**Expected result:** Only ONE deal is created (the publish ref guard prevents double-submit).

#### M-DEAL-NEG-15: Banner placement re-bake on edit
**Steps:**
1. Go through wizard to Layout step. Pick **Right**.
2. Continue to Review — verify cover banner has text on right.
3. Go back to Heading step, change the heading.
4. Continue back to Review.

**Expected result:** The cover banner re-bakes with the NEW heading + the **Right** placement preserved. There is no "ghost text" from the old heading bleeding through.

#### M-DEAL-NEG-16: Start over button clears everything
**Steps:**
1. Fill several steps of the wizard.
2. Tap the **Start Over** button (top right of the wizard top bar).
3. Confirm in the modal that asks "Start over?"

**Expected result:** Wizard returns to step 0 with a blank slate. Saved draft in localStorage is cleared.

---

## 4. Merchant — Create Deal of the Day (DOTD)

DOTD is a featured deal that runs for **a single day**. Wizard order:
**Store → Template → Image → Heading → Offer → Description → Badges → Layout → Date → Review.**
The big differences vs Regular Deal: single-day window, premium tier feature with its own quota, and it gets a yellow "DOTD" badge throughout the consumer feed.

### Happy path

#### M-DOTD-01: Create + publish a Deal of the Day
**Pre-conditions:**
- Logged-in merchant on a plan with `max_dotd_per_month > 0` and quota remaining.
- At least one store created.
- A clean product photo.

**Steps:**
1. From Dashboard, tap **+ → Deal of the Day**.
2. **Store step:** select store. Tap **Next**.
3. **Template step:** tap **Skip — start from scratch** (or pick a DOTD template).
4. **Image step:** upload a clean photo, wait for upload-time check, tap **Continue**.
5. **Heading step:** enter a punchy short title (DOTD usually shorter than regular). Tap **Next**.
6. **Offer step:** enter offer (e.g. "Flat 50% Off — Today Only"). Tap **Next**.
7. **Description step:** enter description. Tap **Next**.
8. **Badges step:** select 2–4 trust badges. Tap **Next**.
9. **Layout step:** pick a placement (Auto/Left/Right/Top/Bottom). Tap **Continue**.
10. **Date step:** pick a date — today, tomorrow, or any future date that doesn't already have a DOTD for this store.
11. Tap **Next** → **Review** step.
12. Verify the consumer-style preview shows the **yellow "Deal of the Day"** banner overlay on the image.
13. Tap **Publish Deal of the Day**.
14. Watch the 3-step progress modal.

**Expected result:**
- Step 12 preview includes the yellow DOTD badge.
- Step 13 succeeds and lands on a success screen.
- Deal appears in **My Campaigns → Active** with a DOTD marker.
- A consumer in the same locality sees the deal in their **Deal of the Day** carousel for the chosen date.

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

#### M-DOTD-02: Schedule a DOTD for a future date
**Steps:**
1. Same as M-DOTD-01 through step 9.
2. On Date step, pick a date 5 days from today.
3. Continue to Review and Publish.

**Expected result:**
- Deal saves with that future date.
- Consumer does NOT see it on their feed today.
- On the chosen date (or after), it appears in the consumer DOTD carousel.

---

#### M-DOTD-03: DOTD with merchant photo from "Your Images" library
**Pre-conditions:** Merchant has previously published deals (so the image library has options).

**Steps:**
1. Start DOTD wizard, reach Image step.
2. Tap **Your Images** to expand the library.
3. Pick a previously uploaded raw photo (NOT a previously baked banner).
4. Verify it becomes the cover.
5. Continue through wizard.

**Expected result:**
- Library shows past images. Picking one populates the cover slot without a re-upload.
- If you pick a baked banner (filename contains `promo-banner-`), the wizard's bake-on-bake guard at Review skips re-baking, so no ghost text appears.

---

### Negative scenarios

#### M-DOTD-NEG-01: Try to schedule a DOTD on a date that already has one
**Pre-conditions:** A DOTD already exists for store X on date Y.

**Steps:**
1. Create another DOTD wizard for the SAME store.
2. On Date step, pick date Y.

**Expected result:**
- Date picker shows Y as unavailable / grey, OR
- Selecting Y shows error: "This store already has a Deal of the Day for that date."

#### M-DOTD-NEG-02: DOTD on a past date
**Steps:**
1. On Date step, try to pick yesterday.

**Expected result:** Past dates are disabled in the date picker.

#### M-DOTD-NEG-03: DOTD quota exhausted
**Pre-conditions:** Merchant on plan with `max_dotd_per_month = 4`, already published 4 this month.

**Steps:** Tap **+ → Deal of the Day**.

**Expected result:** Either the DOTD button shows quota-exhausted state, or wizard opens but blocks at Publish with an upgrade prompt naming the DOTD limit specifically.

#### M-DOTD-NEG-04: DOTD without a paid plan
**Pre-conditions:** Merchant on free / trial plan that excludes DOTD.

**Steps:** Tap **+** → look for **Deal of the Day**.

**Expected result:** DOTD option is either hidden, disabled, or tagged with a **PRO** lock badge that opens an upgrade screen on tap.

#### M-DOTD-NEG-05: Edit a DOTD after the date passes
**Pre-conditions:** A DOTD exists for yesterday.

**Steps:**
1. Open My Campaigns → Expired.
2. Tap the expired DOTD.
3. Look for an **Edit** button.

**Expected result:** Edit is unavailable (DOTD is one-day; expired DOTD cannot be re-edited). A **Renew as new DOTD** action may be available instead.

#### M-DOTD-NEG-06: Watermarked image at upload (DOTD wizard)
**Steps:** Same as M-DEAL-NEG-04 but inside the DOTD wizard.

**Expected result:** Same — flagged image auto-removed with named reason. Behavior is identical to the regular deal wizard since both share `StepImage`.

#### M-DOTD-NEG-07: Session expires mid-DOTD wizard
**Steps:** Same as M-DEAL-NEG-10.

**Expected result:** The 4-minute heartbeat in DotdWizard should keep the JWT alive; publish should succeed.

---

## 5. Merchant — Buy & Get Free mode

"Buy & Get Free" is a special template that injects a **Free Gifts** step into the wizard. Available for both Regular Deals and DOTD.

Wizard order with this mode active:
**Store → Template → Image → FreeGifts → Heading → Offer → Description → Badges → Layout → Start Date → End Date → Review.**

### Happy path

#### M-BGF-01: Create a regular deal with Buy & Get Free template
**Steps:**
1. Tap **+ → New Deal**.
2. Pick a store.
3. **Template step:** tap the **Buy & Get Free Gift** template card.
4. Continue to Image step. Upload cover image.
5. **Free Gifts step:**
   1. Tap **Add Gift**.
   2. Upload a small gift image (e.g. an oil dispenser photo).
   3. Enter Gift Name (e.g. "Stainless Steel Oil Dispenser").
   4. Repeat for a second gift if desired (max 3).
6. Tap **Next**. Continue through Heading / Offer / Description / Badges / Layout / Dates.
7. **Review step:** verify the consumer preview shows a pink **Free Gifts Included** section listing each gift with image + name.
8. Publish.

**Expected result:**
- Step 7 preview includes the pink gift section.
- After publish, consumer sees the deal with the **Free Gifts Included** band.
- A separate auto-generated **"Choose your FREE GIFT"** showcase image is added to the deal's media carousel automatically.

---

#### M-BGF-02: Buy & Get Free in DOTD wizard
**Steps:**
1. Tap **+ → Deal of the Day**.
2. Pick the **Buy & Get Free** DOTD template.
3. Walk through the same flow as M-BGF-01, with a single date instead of date range.

**Expected result:** Same as M-BGF-01 plus the yellow DOTD badge.

---

### Negative scenarios

#### M-BGF-NEG-01: Add gift with no name
**Steps:**
1. On Free Gifts step, upload a gift image but leave the name empty.
2. Tap **Next**.

**Expected result:** Either inline error on the name field, OR the gift is silently skipped at publish time and not shown to consumers.

#### M-BGF-NEG-02: Add gift with no image
**Steps:**
1. On Free Gifts step, type a gift name but don't upload an image.
2. Tap **Next**.

**Expected result:** Validation blocks **Next** with: "Each gift needs an image."

#### M-BGF-NEG-03: Try to add a 4th gift
**Steps:** Add 3 gifts. Try to add a 4th.

**Expected result:** **Add Gift** button is disabled or hidden after 3.

#### M-BGF-NEG-04: Inappropriate gift image
**Steps:** Upload a gift image that fails moderation (e.g. a watermarked or inappropriate photo).

**Expected result:** At publish time, the moderation step flags the gift image with a clear reason. Publish is blocked.

#### M-BGF-NEG-05: Switch templates mid-wizard
**Steps:**
1. Start with **Buy & Get Free** template, fill 2 gifts.
2. Go back to Template step.
3. Pick **Skip — start from scratch**.
4. Walk forward.

**Expected result:**
- Free Gifts step is removed from the wizard sequence.
- The 2 already-added gifts are discarded silently (or with a "discard gifts?" prompt).
- Wizard does not crash from a stale step reference.

---

## 6. Merchant — Stores Management

Accessed via **Profile → My Stores**. Lists all the merchant's stores with edit / delete / set-primary actions.

### Happy path

#### M-STOR-01: View store list
**Pre-conditions:** Merchant has at least 1 store.

**Steps:**
1. Login → tap **Profile** tab.
2. Tap **My Stores**.

**Expected result:**
- All stores are listed with name, city, phone, hours.
- Each store has an **Edit** and **Delete** button.
- Cached load: list appears within 100ms on second visit (the 1-hour stores cache is hot).

---

#### M-STOR-02: Add a new store
**Steps:**
1. **Profile → My Stores → +** (Add Store).
2. Enter Store Name.
3. Tap **Use my current location** OR enter address fields manually.
4. Pick store hours (or toggle **24 hours**).
5. Enter store phone, optional alternate phone.
6. Toggle **We deliver to customers** and pick a delivery range (1–10 km or city-wide).
7. Tap **Add Store**.

**Expected result:**
- Modal closes; the new store appears at the bottom of the list within 1 second.
- The store cache is invalidated, so the next deal wizard sees the new store.
- The submit button is fully visible above the device's bottom UI (safe-area-inset works).

---

#### M-STOR-03: Edit an existing store
**Steps:**
1. Tap **Edit** on any store.
2. Change the phone number.
3. Tap **Save Changes**.

**Expected result:**
- Save succeeds, list shows the updated phone immediately.
- Cache is invalidated; consumer-facing deal modal showing this store's phone reflects the change on next refresh.

---

#### M-STOR-04: Delete a store with no active deals
**Pre-conditions:** Store has zero active campaigns.

**Steps:**
1. Tap **Delete** on the store.
2. Confirm in the popup.

**Expected result:** Store is removed from the list.

---

#### M-STOR-05: Toggle delivery option on / off
**Steps:**
1. Edit a store. Toggle **We deliver to customers** ON.
2. Pick a range (e.g. 5 km).
3. Save.
4. Open any deal published from this store on the consumer side.

**Expected result:**
- Consumer sees the green **Delivery available within 5 km** card under the category tag, with the disclaimer below it.
- Toggle off + save → card disappears from consumer side after refresh.

---

### Negative scenarios

#### M-STOR-NEG-01: Add store on plan that allows only one
**Pre-conditions:** Merchant on a single-store plan, already has 1 store.

**Steps:** Tap **+ → Add Store**.

**Expected result:** Either the **+** is hidden / disabled, or tapping it opens an upgrade prompt naming the store quota.

#### M-STOR-NEG-02: Delete a store that has active deals
**Steps:** Tap Delete on a store with running campaigns.

**Expected result:** Either deletion is blocked with "Cannot delete: store has active campaigns. End or delete campaigns first," OR the deletion soft-deletes (sets `active_status = 'disabled'`) and existing campaigns finish out their dates without disruption.

#### M-STOR-NEG-03: Save store with no name
**Steps:** Add Store → leave name blank → Save.

**Expected result:** Inline error on the name field. Save blocked.

#### M-STOR-NEG-04: Save store with invalid phone
**Steps:** Enter a 5-digit phone, save.

**Expected result:** Validation error "Phone must be 10 digits."

#### M-STOR-NEG-05: Save store without GPS coordinates
**Steps:**
1. Manually enter address but never tap "Use my current location" (no lat/lng captured).
2. Save.

**Expected result:** Either the form blocks save with "Tap to use location for accurate map placement," OR the save succeeds but a warning appears on the store row that distance-based discovery won't work for this store until coords are added. Test both paths and flag any inconsistency.

#### M-STOR-NEG-06: Delivery toggle ON without a range
**Steps:**
1. Toggle delivery ON.
2. Don't pick a range.
3. Save.

**Expected result:** Validation: "Pick a delivery range."

#### M-STOR-NEG-07: Network failure during save
**Steps:** Fill the form, kill network, tap Save.

**Expected result:** Clear error "Could not save. Please check your network." Form data preserved; retry works.

#### M-STOR-NEG-08: Edit a store while another tab/device edits the same store
**Steps:** Edit store on Device A, change phone. Before saving, edit same store on Device B, change hours, and save B first.

**Expected result:** When A saves, either:
- A's save overwrites B's hours (last-write-wins — current behavior, document it), OR
- A receives a stale-data warning.
Either way, no crash; the data is consistent at the end.

#### M-STOR-NEG-09: Cache shows stale data
**Steps:**
1. Add a store.
2. Immediately open the regular-deal wizard.
3. On Store step, look for the new store.

**Expected result:** New store IS in the list (cache was invalidated by the add operation). If not, file a bug.

---

## 7. Merchant — Product Catalogue

The product catalogue is a separate listing of items the merchant sells (distinct from time-bound deals). Accessed via the **Catalogue** tab. Wizard order:
**Store → Lookup → Category → Photo → Price/Stock → Review.**

### Happy path

#### M-PROD-01: Add a new product end-to-end
**Pre-conditions:** Logged-in merchant, at least one store.

**Steps:**
1. Tap **Catalogue** tab.
2. Tap **+ Add Product**.
3. **Store step:** select store. Tap **Next**.
4. **Lookup step:** type a product name (e.g. "Amul butter 500g"). Tap **Search**.
5. If a global product matches, tap **Use this product** to pre-fill name/category/image. Otherwise tap **Skip — enter manually**.
6. **Category step:** pick or confirm category. Tap **Next**.
7. **Photo step:** upload a clean product photo. Wait for upload-time profanity + copyright check.
8. Tap **Continue**.
9. **Price/Stock step:** enter MRP, Selling Price, Stock count.
10. Tap **Next**.
11. **Review step:** verify all fields. Tap **Save Product**.

**Expected result:**
- Product appears in **Catalogue → My Products** within 1 second.
- Product is searchable in the consumer's product search globally.
- Photo went through the same upload-time vision check as deal images.

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

#### M-PROD-02: Add product using global lookup pre-fill
**Steps:**
1. Catalogue → + Add Product → Store step → Next.
2. Lookup: type a known product (e.g. "Coca-Cola 500ml").
3. Tap a search result.

**Expected result:**
- Name, category, brand, default photo are pre-filled.
- Tester only needs to confirm price + stock.

---

#### M-PROD-03: Edit existing product
**Steps:**
1. Catalogue → tap a product card → **Edit**.
2. Change price.
3. Save.

**Expected result:** Updated price reflects on the catalogue list and consumer-side product detail page.

---

#### M-PROD-04: Bulk view + filter
**Steps:**
1. Catalogue → My Products.
2. Use the search bar to filter by name.
3. Tap category pills to filter by category.

**Expected result:**
- Filters narrow the list in real time.
- Empty filter (no matches) shows a "No products match" empty state.

---

### Negative scenarios

#### M-PROD-NEG-01: Save product without a photo
**Steps:** Skip the Photo step (if possible) or upload nothing. Try to advance.

**Expected result:** Photo is required; **Continue** is disabled.

#### M-PROD-NEG-02: Selling price > MRP
**Steps:** Enter MRP = 100, Selling Price = 150. Tap Next.

**Expected result:** Validation: "Selling price must be less than or equal to MRP." Cannot advance.

#### M-PROD-NEG-03: Negative or zero stock
**Steps:** Enter Stock = `-5` or `0`. Tap Next.

**Expected result:** Validation blocks negative; zero may be allowed (out of stock) — verify which behavior the product spec requires and flag if inconsistent.

#### M-PROD-NEG-04: Photo with watermark / copyright issue
**Steps:** Upload a watermarked photo. Wait for upload-time check.

**Expected result:** Same as M-DEAL-NEG-04 — auto-removed with named reason. No need to wait until publish.

#### M-PROD-NEG-05: Duplicate product name (same store)
**Steps:** Add a product. Try to add a second product with the EXACT same name in the same store.

**Expected result:** Either system allows duplicates (acceptable, document it) OR shows "A product with this name already exists in this store."

#### M-PROD-NEG-06: Delete product that's referenced by an active deal
**Pre-conditions:** A campaign references the product (if your data model supports linking).

**Steps:** Try to delete the product.

**Expected result:** Either deletion is blocked with a "remove deal references first" message, OR deletion soft-deletes and the linked deal continues to work.

#### M-PROD-NEG-07: Network failure during product save
**Steps:** Fill all steps. Kill network at Save.

**Expected result:** Clear error, form data preserved, retry succeeds when network restored.

#### M-PROD-NEG-08: Unsupported image format
**Steps:** Upload a `.heic` or `.svg` photo on Photo step.

**Expected result:** Error: "Unsupported format. Please use JPG or PNG." (or whatever the supported list is).

---

## 8. Merchant — Dashboard / Analytics

The dashboard is the home screen. Renders welcome greeting, festival calendar tiles, lifetime counters (deals / clicks / redemptions / invites), per-campaign engagement, recent deals, and quick actions.

### Happy path

#### M-DASH-01: Dashboard loads end-to-end
**Pre-conditions:** Logged-in merchant with at least 1 published deal and 1 store.

**Steps:**
1. Login → land on Dashboard (Console tab).
2. Wait up to 5 seconds for all widgets to render.

**Expected result:**
- Greeting tile (Good morning / afternoon / evening + merchant name).
- Quick actions bar (+ Deal, + DOTD, + Product).
- Lifetime counters tiles: Total Deals, Total Clicks, Total Redemptions, Invites Sent / Accepted.
- Festival calendar — upcoming festivals grouped by month.
- Recent deals carousel.
- All counters render values (not stuck on 0 if data exists, not stuck on `—`).

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

#### M-DASH-02: Dashboard re-open within 5 minutes uses cache
**Steps:**
1. Open dashboard, observe network calls in DevTools.
2. Navigate to a different tab and back to Dashboard within 5 minutes.

**Expected result:**
- Counters render instantly.
- DevTools shows ZERO calls to `get-total-lifetime-*` and `get-campaign-specific-*` (cache hit).
- Festival calendar also instant (cached).

---

#### M-DASH-03: View counter accuracy after publishing a new deal
**Steps:**
1. Note current "Total Deals" counter.
2. Publish a new deal via M-DEAL-01.
3. Return to Dashboard.

**Expected result:**
- "Total Deals" increases by exactly 1.
- May take up to 5 minutes if the cache hasn't expired; force a refresh by closing the app and reopening, or wait for the cache TTL.

---

#### M-DASH-04: Festival calendar links to deal creation
**Steps:**
1. Tap a festival tile (e.g. "Diwali — 15 days away").
2. Observe behavior.

**Expected result:**
- Either opens a pre-filled new-deal wizard with that festival as the heading template, OR shows festival info with a "Create deal" CTA.
- Document whichever behavior the product spec defines.

---

#### M-DASH-05: Tap a recent deal to view details
**Steps:**
1. From Recent Deals carousel, tap any deal card.

**Expected result:** Opens the same view-deal modal that's used in My Campaigns (M-CAMP-02). Includes media carousel, store info, performance counters, edit button (if within 2-hour window).

---

### Negative scenarios

#### M-DASH-NEG-01: Brand-new merchant with no data
**Pre-conditions:** Merchant just signed up, no deals yet.

**Steps:** Land on Dashboard.

**Expected result:**
- All counters show `0` (not blank, not "loading…" forever).
- Festival calendar still renders.
- Recent Deals carousel shows an empty-state CTA: "No deals yet — create your first one."

#### M-DASH-NEG-02: Network failure on first dashboard load
**Steps:** Login while offline (or kill network mid-load).

**Expected result:**
- Counters show last-cached values if any (graceful degradation), otherwise `—`.
- A "tap to retry" affordance is visible.
- App does NOT crash or stay on a blinking spinner.

#### M-DASH-NEG-03: One counter edge function returns 401
**Steps:** Use DevTools → Network → block the URL `…/get-total-lifetime-deals`. Reload Dashboard.

**Expected result:**
- The single failing tile shows `—` or last-cached value; OTHER counters render normally.
- The error does not cascade to break the whole dashboard.

#### M-DASH-NEG-04: Session expires while looking at dashboard
**Steps:** Sit on Dashboard for 1+ hours without navigation. Tap a counter or refresh.

**Expected result:** Should silently re-auth via the global token-refresh wrapper. Dashboard re-renders normally. If re-auth fails, polite "please log in again" prompt — never a crash.

#### M-DASH-NEG-05: Dashboard counter mismatches reality
**Steps:** Cross-check Total Deals counter vs the actual count in **My Campaigns → Active + Expired + Deleted**.

**Expected result:** Counters match (or differ in a documented way — e.g. Total Deals only counts non-deleted). If they're inconsistent, file a bug with the discrepancy.

#### M-DASH-NEG-06: Festival calendar shows wrong region
**Pre-conditions:** Merchant store is in Karnataka.

**Steps:** Open Dashboard.

**Expected result:** Festival calendar prioritizes Karnataka festivals (Ugadi, Karnataka Rajyotsava) over national-only.

---

## 9. Merchant — My Campaigns

The **Campaigns** tab lists active and expired deals with engagement metrics, edit / renew / delete actions, and an ROI calculator.

### Happy path

#### M-CAMP-01: View Active vs Expired tabs
**Steps:**
1. Tap **Campaigns** tab.
2. Observe the **Active** tab (default) — should list all currently-running deals.
3. Tap **Expired** tab.

**Expected result:**
- Active tab: deals where today is between `start_date` and `end_date`.
- Expired tab: deals where `end_date < today`.
- Each card shows the deal heading, image thumbnail, dates, and three counters: Views, Claims, Redeemed.

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

#### M-CAMP-02: Open the deal preview modal
**Steps:**
1. From Campaigns list, tap any deal card.
2. The full-screen consumer-style preview opens.

**Expected result:**
- Carousel of all media (cover + additional + video if present).
- Store name, heading, category tag, rating placeholder, offer value, validity date.
- "DELIVERY OPTION" banner if the store delivers (next to heading).
- Phone row with `tel:` link, store hours, address, landmark in Store Info.
- Free Gifts section if the deal is a Buy & Get Free deal.
- Campaign Performance section (Clicks / Claims / Redeemed counts).
- **Edit** button if `created_at` is < 2 hours ago.
- **Close Preview** button at the bottom.

---

#### M-CAMP-03: Edit a recent deal
**Pre-conditions:** A deal published less than 2 hours ago.

**Steps:**
1. Open the preview modal for that deal.
2. Tap **Edit**.

**Expected result:** Wizard opens pre-filled. Same flow as M-DEAL-05.

---

#### M-CAMP-04: Renew an expired deal
**Pre-conditions:** A deal in the Expired tab.

**Steps:**
1. Switch to **Expired** tab.
2. Tap a deal card → tap **Renew**.
3. Pick new start + end dates.
4. Confirm.

**Expected result:** Deal is recreated with new dates and same content. New `campaign_id`. Old expired record is preserved as historical.

---

#### M-CAMP-05: ROI calculator on an active deal
**Steps:**
1. On an active deal card, tap the **calculator icon** (or expand to see ROI inputs).
2. Enter Expected Redemptions, Average Transaction Value, Profit Margin %.
3. Read the projected revenue + ROI.

**Expected result:**
- ROI updates instantly as inputs change.
- Numbers persist for that campaign (saved to merchant state).

---

#### M-CAMP-06: Auto-refresh active counters
**Steps:** Sit on Campaigns tab for 30 seconds.

**Expected result:** Counters refresh every 10 seconds (silent background poll). New consumer interactions (a fresh claim) appear in the count without manual reload.

---

### Negative scenarios

#### M-CAMP-NEG-01: Edit window expired
**Pre-conditions:** A deal published 3+ hours ago.

**Steps:** Open preview → look for Edit button.

**Expected result:** Edit button is hidden or disabled with a "Edit window closed" tooltip.

#### M-CAMP-NEG-02: Renew using past dates
**Steps:** On Renew dialog, try to pick yesterday as start date.

**Expected result:** Past dates are disabled in the picker.

#### M-CAMP-NEG-03: Renew when out of monthly quota
**Pre-conditions:** Plan quota exhausted for this month.

**Steps:** Tap Renew on an expired deal.

**Expected result:** Renew blocked with "Quota exhausted — upgrade to renew this deal." Existing deal unchanged.

#### M-CAMP-NEG-04: Delete deal — confirm prompt
**Steps:** Tap Delete on an expired deal. Cancel the confirmation.

**Expected result:** Deal NOT deleted. Cancellation is honored.

#### M-CAMP-NEG-05: Delete then publish — quota check
**Steps:** Delete a deal. Try to publish a new one.

**Expected result:** Document whether deletion frees up quota for the month or not. If quota is per-publish (cumulative), deletion does NOT free space.

#### M-CAMP-NEG-06: Empty Active tab when all deals expired
**Steps:** Wait until all deals are past their end_date. Open Campaigns → Active.

**Expected result:** Empty state: "No active campaigns. Create a new one." with a CTA button to the wizard.

#### M-CAMP-NEG-07: View deal whose store was deleted
**Pre-conditions:** A deal exists, but its associated store has been soft-deleted.

**Steps:** Open the deal preview.

**Expected result:** Preview still loads. Store info section either shows the original store details (snapshotted at publish time) OR a polite "Store no longer available" placeholder. No crash.

#### M-CAMP-NEG-08: Counter shows stale value briefly after a new claim
**Steps:** Have a consumer claim the deal. Within 5 seconds, refresh Campaigns.

**Expected result:** Counter updates within at most 30 seconds (the polling cadence + cache TTL). If it takes longer than 60 seconds, file a bug.

#### M-CAMP-NEG-09: Auto-refresh causes UI flicker
**Steps:** Sit on Campaigns tab for 60 seconds, scroll to a specific deal.

**Expected result:** Counter polling does NOT cause visible jank, scroll position to reset, or full-list re-render.

---

## 10. Merchant — Subscriptions

DealPro has tiered subscriptions (e.g. Trial → Starter → Pro). Each tier has different limits on max campaigns/month, max DOTD/month, multi-store, etc.

### Happy path

#### M-SUB-01: View subscription details
**Steps:**
1. **Profile → Subscription** (or **Profile → Plan**).
2. Observe current plan name, billing date, days remaining, included features.

**Expected result:**
- Plan name, status (Active / Trial / Expired), billing cycle, next renewal date.
- Feature list shows what's included vs not.
- Quota counters (X of Y campaigns used this month).

---

#### M-SUB-02: Start a free trial on signup
**Pre-conditions:** Brand-new merchant just signed up.

**Steps:**
1. Complete onboarding.
2. Land on Dashboard.
3. Verify Subscription panel shows "Trial — N days remaining."

**Expected result:**
- Trial auto-activates at signup with the configured days (e.g. 14).
- All trial-tier features are unlocked.
- A countdown is visible somewhere.

---

#### M-SUB-03: Upgrade from Trial to Paid
**Steps:**
1. **Profile → Subscription → Upgrade**.
2. Pick a paid tier from the comparison cards.
3. Tap **Subscribe**.
4. Complete the Google Play (Android) or Apple In-App Purchase (iOS) flow.
5. After purchase confirmation, return to Dashboard.

**Expected result:**
- Purchase completes via the OS billing sheet.
- Subscription status flips to **Active — <Plan name>** within 30 seconds (entitlement webhook delivered).
- Newly-unlocked features (multi-store, DOTD, higher quota) become available.

---

#### M-SUB-04: Restore purchases on a new device
**Pre-conditions:** Same merchant account already paid on Device A. Now logging in on Device B.

**Steps:**
1. Login on Device B.
2. **Profile → Subscription → Restore Purchases**.

**Expected result:** Subscription is recognized; tier matches Device A within 60 seconds.

---

#### M-SUB-05: Quota panels reflect plan
**Steps:** Compare quota counters in Dashboard / Subscription / wizard quota-blocked screens.

**Expected result:** All three surfaces show identical numbers (e.g. "3 of 10 deals used this month"). No drift between displays.

---

### Negative scenarios

#### M-SUB-NEG-01: Trial expired — try to publish
**Pre-conditions:** Trial ended yesterday. No paid subscription.

**Steps:** Tap **+ → New Deal**.

**Expected result:** Either the wizard refuses to open with an upgrade prompt, OR opens but blocks at Publish with "Trial expired — subscribe to continue."

#### M-SUB-NEG-02: Cancelled subscription — what features remain?
**Steps:**
1. Subscribe.
2. Cancel mid-cycle via Google Play / App Store.
3. Wait for the cycle to end.
4. Try to publish.

**Expected result:** During the remaining cycle, all paid features still work. Once the cycle ends, the merchant downgrades to free / trial-expired tier with appropriate restrictions.

#### M-SUB-NEG-03: Failed payment renewal
**Steps:** Configure a test card to decline. Wait for renewal date.

**Expected result:**
- Subscription status flips to "Payment failed — please update payment method."
- A retry CTA is visible.
- Features stay unlocked for a configured grace period (e.g. 3 days), then revoke.

#### M-SUB-NEG-04: Quota check mid-publish
**Steps:** With 1 campaign quota left, start two wizards in two browser tabs at the same time. Publish both nearly simultaneously.

**Expected result:** Only ONE publishes successfully. The other gets a clear "Quota exhausted" error at publish step (server-side check is authoritative, not client-side counter).

#### M-SUB-NEG-05: Network failure during purchase flow
**Steps:** Start the purchase flow, kill network mid-purchase.

**Expected result:** OS billing sheet handles its own retry / cancel. App returns to the Subscription screen without changing tier and no charge.

#### M-SUB-NEG-06: Downgrade before cycle end
**Steps:** From Pro, request a downgrade to Starter.

**Expected result:**
- Either the downgrade takes effect at the end of the current billing cycle (preferred, document this), OR
- Immediate downgrade with prorated refund.
- Document whichever behavior the spec defines.

#### M-SUB-NEG-07: Subscription expired but cached counters show old plan
**Steps:** Let trial expire mid-session (force expiry by changing system date for a test).

**Expected result:** Within 10 minutes (or on next dashboard refresh), the UI reflects the new tier limits. Existing in-flight wizards may complete or block — document which.

#### M-SUB-NEG-08: Duplicate subscription on the same Google Play account
**Steps:** Subscribe twice in quick succession (rare, but possible if user double-taps).

**Expected result:** Google Play prevents duplicate; if it doesn't, the merchant should see only ONE active sub on the Subscription panel.

---

## 11. Merchant — Profile + Staff invites

The **Profile** tab houses: account info, language picker, theme toggle, subscription, stores, **My Team** (staff invites), help, logout.

### Happy path

#### M-PROF-01: View and edit profile
**Steps:**
1. Profile → tap own name / avatar.
2. Edit name, email, business category.
3. Save.

**Expected result:** Save succeeds; updated values persist after navigating away and back.

---

#### M-PROF-02: Switch language
**Steps:**
1. Profile → Language → pick **हिन्दी (Hindi)**.
2. Confirm if prompted.

**Expected result:**
- App UI re-renders in Hindi within 1 second.
- Major screens (Dashboard, Campaigns, Profile, wizards) all show Hindi labels.
- Re-launch the app — language persists.

#### M-PROF-03: Test all 9 supported languages
**Steps:** Repeat M-PROF-02 for each of: English, Hindi, Kannada, Tamil, Telugu, Malayalam, Bengali, Marathi, Gujarati.

**Expected result:** Each language renders without missing translations / fallback English strings on critical surfaces. Untranslated strings should fall back to English gracefully (not show the key like `m_start_over_btn`).

---

#### M-PROF-04: Toggle dark / light theme
**Steps:** Profile → Theme → flip the toggle.

**Expected result:** Whole app instantly re-themes. Persists after restart. Both themes are readable on every screen.

---

#### M-PROF-05: Invite a staff member
**Pre-conditions:** Merchant on a plan that allows staff (multi-user feature).

**Steps:**
1. Profile → My Team → Invite Member.
2. Enter the staff member's phone number.
3. Pick a role (Manager / Cashier).
4. Tap **Send Invite**.

**Expected result:**
- Invite is created. The invited person receives an SMS with a link / invite code.
- Invite shows in **My Team → Pending** with a "Resend" option.

---

#### M-PROF-06: Staff accepts invite
**Pre-conditions:** M-PROF-05 just completed.

**Steps:**
1. On the staff member's phone, tap the SMS link OR open the app and tap **Have an invite code?**
2. Enter the invite code.
3. Sign up via OTP.
4. Land in the merchant's account context.

**Expected result:**
- Invite moves from **Pending → Active** in the owner's My Team list.
- Staff can access merchant data per their role permissions (e.g. Cashier can scan QRs but cannot publish deals).

---

#### M-PROF-07: Logout
**Steps:** Profile → Logout → confirm.

**Expected result:**
- Returns to landing screen.
- Session cleared from localStorage.
- Re-launching the app shows the landing screen, not the dashboard.
- Biometric option is preserved (next login can use biometric if enabled).

---

### Negative scenarios

#### M-PROF-NEG-01: Save profile with invalid email
**Steps:** Edit profile → enter `not_an_email` → Save.

**Expected result:** Validation: "Enter a valid email." Save blocked.

#### M-PROF-NEG-02: Invite staff on a plan that doesn't allow it
**Pre-conditions:** Merchant on a tier without `is_multi_store` / staff feature.

**Steps:** Profile → look for **My Team**.

**Expected result:** Either My Team is hidden, OR visible but tapping shows an upgrade prompt with the staff feature pricing.

#### M-PROF-NEG-03: Invite the same phone number twice
**Steps:** Send an invite to phone X. Before X accepts, send another invite to the same X.

**Expected result:** Second invite is either blocked with "Invite already pending for this number," or the existing invite is re-sent (idempotent).

#### M-PROF-NEG-04: Invite owner's own number
**Steps:** Try to invite your own merchant phone number.

**Expected result:** Blocked with "Cannot invite yourself."

#### M-PROF-NEG-05: Staff tries to access owner-only features
**Pre-conditions:** Logged in as a Cashier role.

**Steps:** Look for billing / subscription / staff invites in Profile.

**Expected result:** Owner-only sections are hidden or show a "Owner access required" message. Cashier cannot trigger upgrades or invite more staff.

#### M-PROF-NEG-06: Revoke active staff
**Steps:** Profile → My Team → tap an active staff member → **Remove**.

**Expected result:**
- Confirmation prompt.
- After confirming, staff loses access on their next API call (within 1 minute).
- They are kicked out to the landing screen.

#### M-PROF-NEG-07: Logout while a publish is in progress
**Steps:** Start publishing a deal. As the progress modal shows, tap Logout from the side menu (if reachable).

**Expected result:** Either Logout is blocked during publish, OR it cancels the publish cleanly without leaving a half-saved campaign in the database.

#### M-PROF-NEG-08: Switch language while in a wizard
**Steps:** Mid-deal-wizard, navigate to Profile → switch language → return to the wizard.

**Expected result:**
- Wizard re-renders in the new language.
- Field values entered so far are preserved (not wiped).
- Validation messages are in the new language.

#### M-PROF-NEG-09: Untranslated string fallback
**Steps:** Walk through every screen in each non-English language, noting any English text that appears (other than brand names like "DealPro").

**Expected result:** A list of untranslated strings goes into the bug tracker as a "translations" sweep. Each one is a separate S3 (Minor) bug.

---

## 12. Consumer — Authentication

The consumer app uses phone-based OTP for signup + login. Returning users get biometric quick-login. Silent re-auth via cached phone covers most session expiries.

### Happy path

#### C-AUTH-01: New consumer signup
**Pre-conditions:** Fresh install OR cleared storage. Phone not registered.

**Steps:**
1. Open the consumer app.
2. Tap **Sign up / Login**.
3. Enter a 10-digit Indian mobile.
4. Tap **Send OTP**, wait, enter OTP.
5. Tap **Verify**.

**Expected result:**
- Lands on the consumer **Onboarding** flow (location preference, language pick).
- After onboarding, lands on the deals home screen.
- Consumer profile row created in DB.

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

#### C-AUTH-02: Existing consumer login
**Pre-conditions:** Phone already registered as consumer.

**Steps:** Same as C-AUTH-01.

**Expected result:** Skips onboarding, lands directly on home with prior preferences (favorites, location) restored.

---

#### C-AUTH-03: Biometric quick-login
**Pre-conditions:** Login succeeded once on this device, biometric enabled at OS.

**Steps:** Open app from cold start → tap **Use Biometric** → authenticate.

**Expected result:** Lands on home within 2 seconds, no OTP.

---

#### C-AUTH-04: Silent re-auth on stale session
**Pre-conditions:** Last login 30+ days ago.

**Steps:** Cold-open the app.

**Expected result:** App attempts silent re-authentication via the cached phone (`consumerOtpLogin` edge function). User sees a brief "Restoring session…" or just loads straight to home. Does NOT show login screen unless silent re-auth fails.

---

### Negative scenarios

#### C-AUTH-NEG-01: Invalid phone format
**Steps:** Enter `abc` or a 5-digit number, tap Send OTP.

**Expected result:** Inline validation error. Send OTP does not fire.

#### C-AUTH-NEG-02: Wrong OTP retries
**Steps:** Enter wrong OTP 3 times.

**Expected result:** Same as M-AUTH-NEG-03 — lock with resend option.

#### C-AUTH-NEG-03: OTP delivered as merchant instead of consumer
**Pre-conditions:** Phone registered as a merchant.

**Steps:** Try to sign up as a consumer with the same phone.

**Expected result:** Either blocked with "This number is already a merchant — use a different number," OR allowed (dual-role). Document the spec'd behavior.

#### C-AUTH-NEG-04: No internet during signup
**Steps:** Airplane mode → start signup.

**Expected result:** Clear "No internet" error; retry works after enabling network.

#### C-AUTH-NEG-05: Biometric mismatch
**Steps:** Biometric prompt → use a wrong fingerprint.

**Expected result:** App returns to landing screen, does not log in.

#### C-AUTH-NEG-06: Logout
**Steps:** Profile → Logout.

**Expected result:** Returns to landing. Saved session cleared. Favorites preserved server-side; will reappear on next login.

---

## 13. Consumer — Location

Location is critical — deals are filtered by distance from the consumer or by city. Two modes: **Auto-detect** (GPS) and **Manual** (city / area picker).

### Happy path

#### C-LOC-01: First-time auto-detect
**Pre-conditions:** Just signed up (C-AUTH-01).

**Steps:**
1. On the location prompt, tap **Use my location**.
2. Allow OS GPS permission.
3. Wait for reverse-geocode (~1–3 sec).

**Expected result:**
- Header shows the resolved locality (e.g. "Indiranagar" or city name).
- Deals home loads deals near that location (within configured radius).
- A search radius setting is visible (default e.g. 5 km).

---

#### C-LOC-02: Manual city pick
**Steps:**
1. Tap the location pill in the header.
2. Search for a city name (e.g. "Mysore").
3. Pick from the dropdown.

**Expected result:**
- Header updates to "Mysore."
- Deals re-fetch for Mysore, replacing the old list.
- No flicker / blank state during the swap (cached deals stay visible until new ones arrive).

---

#### C-LOC-03: Adjust search radius
**Steps:** Location pill → Adjust Radius → pick 10 km (or whatever option).

**Expected result:** Deals re-fetch with new radius. More / fewer deals appear accordingly.

---

#### C-LOC-04: Switch back from city to GPS
**Steps:** From Mysore (manual), tap the location pill → tap **Use my current location**.

**Expected result:** Returns to GPS-detected locality, deals re-fetch.

---

### Negative scenarios

#### C-LOC-NEG-01: GPS permission denied
**Steps:** First-time prompt → tap **Deny**.

**Expected result:** App shows fallback: "We couldn't get your location. Pick a city instead." → city picker UI. Does NOT silently fail or show a blank list.

#### C-LOC-NEG-02: GPS enabled but no fix
**Steps:** Indoors, no GPS satellites visible. Allow permission.

**Expected result:** Spinner for max ~10 seconds, then falls back to "Using last known location" OR "Pick a city" prompt. No infinite spinner.

#### C-LOC-NEG-03: City pick with no deals
**Steps:** Pick a city that has no merchants (e.g. a tiny town).

**Expected result:** Empty state: "No deals available in <city> yet. Try a nearby city or expand your radius." Does NOT show a generic crash or blank screen.

#### C-LOC-NEG-04: Switching location is glitchy
**Steps:** Switch location 3 times in quick succession (city A → city B → city C).

**Expected result:** Final list = city C. No flicker, no "No deals" empty state flash, no race condition where city A's deals appear after C is selected.

#### C-LOC-NEG-05: Stale deals from previous location after change
**Steps:** Switch from city A (with deals) to city Z (no deals).

**Expected result:** City Z's empty state shows. No leftover city A deals. Cache is invalidated correctly on change.

#### C-LOC-NEG-06: Network failure during location change
**Steps:** Pick a new city. Kill network mid-fetch.

**Expected result:** Either fall back to last cached snapshot for the new city (if available) OR show an error with retry. Does not crash or stay on a spinner forever.

#### C-LOC-NEG-07: GPS permission revoked from OS settings
**Steps:** Grant GPS once. Use the app a bit. Go to OS settings, revoke GPS for DealPro. Return to app, attempt auto-detect.

**Expected result:** App detects revocation, shows the same fallback as C-LOC-NEG-01 ("Pick a city").

---

## 14. Consumer — Deals Browse

The home / deals screen shows: the personalized feed, category pills, search, deal cards in a 2-column grid, Deal of the Day carousel, and various recommendation rails (Nearby, Based on Favorites, New This Week).

### Happy path

#### C-HOME-01: Home loads with deals near me
**Pre-conditions:** GPS detected, deals exist nearby.

**Steps:** Open app → land on home.

**Expected result:**
- Search bar at top.
- Category pills row (All, Food, Fashion, Beauty, etc.).
- Deal cards in 2-column grid: thumbnail, store name, heading, offer, validity.
- DOTD carousel at top if any DOTD is active.
- Personalized feed rail.
- All loads within 3 seconds; cached on second visit.

---

#### C-HOME-02: Search by keyword
**Steps:** Type "pizza" in search bar.

**Expected result:** Only deals matching "pizza" in heading / offer / store name remain visible. Real-time filter (no submit button needed).

---

#### C-HOME-03: Filter by category
**Steps:** Tap **Food** category pill.

**Expected result:** Only Food deals remain. Pill highlights as selected. Tap **All** to clear.

---

#### C-HOME-04: Pull to refresh
**Steps:** From the top of the deals list, pull down.

**Expected result:** Spinner appears; cache is invalidated; fresh deals load. New deals (if any published in the last few seconds) appear.

---

#### C-HOME-05: Tap a deal card
**Steps:** Tap any deal in the grid.

**Expected result:** Opens the **Deal Details** screen (covered in Section 15).

---

#### C-HOME-06: SWR — second open is instant
**Steps:**
1. Open app, see deals load (~1-3 sec).
2. Navigate to Profile, then back to home.

**Expected result:** Deals appear instantly from the localStorage cache. A silent background refresh updates them within the cache TTL window. No skeleton blink.

---

### Negative scenarios

#### C-HOME-NEG-01: Empty deal list
**Pre-conditions:** No deals in current location / radius.

**Steps:** Open home.

**Expected result:** Friendly empty state ("No deals near you yet. Try expanding your radius or a different city.") Not a crash, not a blank screen.

#### C-HOME-NEG-02: Search with no matches
**Steps:** Search "xyzabc123" — guaranteed no match.

**Expected result:** Empty state: "No deals match your search."

#### C-HOME-NEG-03: Deal expires while displayed
**Pre-conditions:** A deal whose end_date is today, near midnight.

**Steps:** Have it on screen at 23:59. Wait past midnight.

**Expected result:** On next refresh, the expired deal is gone. Tapping it (if cached UI still shows it) gracefully shows "This deal has expired."

#### C-HOME-NEG-04: Network drop mid-browse
**Steps:** Open home (deals load). Kill network. Scroll, tap a category pill.

**Expected result:** Cached deals remain visible / filterable. New fetches show a small "offline" banner. App does not crash.

#### C-HOME-NEG-05: SWR shows expired deals briefly
**Steps:** Open app. Cached snapshot has a deal that expired 1 day ago.

**Expected result:** Expired deals are filtered out of the cached snapshot before render (verified in earlier work) — they should NOT flash. If they do, file a bug.

#### C-HOME-NEG-06: Deal of the Day carousel with 0 active DOTDs
**Steps:** Open home in a region with no active DOTDs today.

**Expected result:** DOTD carousel is hidden entirely (not shown empty).

#### C-HOME-NEG-07: Personalized feed fails to load
**Steps:** Block the personalized-feed edge function via DevTools.

**Expected result:** That rail is hidden / shows a placeholder. Other rails (Nearby, Categories, etc.) still render.

#### C-HOME-NEG-08: Slow image loading
**Steps:** Throttle network to "Slow 3G" in DevTools.

**Expected result:** Deal card images use lazy-loading + a placeholder. Cards still tap-able while images load. No layout shift as images arrive (aspect ratio is reserved).

#### C-HOME-NEG-09: Image load failure
**Steps:** A deal image whose URL 404s.

**Expected result:** Card shows the default fallback image (`DEFAULT_DEAL_IMAGE`) instead of a broken icon.

---

## 15. Consumer — Deal Details + Redemption

The deal detail screen shows the full deal: media carousel, heading, offer, description, store info, delivery info, free gifts (if any), reviews, and the **Redeem** action that produces a QR voucher for the merchant to scan.

### Happy path

#### C-DET-01: Open and explore a deal
**Steps:**
1. From home, tap a deal card.
2. On the deal detail screen, scroll through:
   - Hero media carousel (swipe through images / video).
   - Store name + heading + category tag.
   - Delivery info card (if store delivers).
   - Offer + validity dates.
   - Free gifts section (if any).
   - Description.
   - Store Info expandable (store name, address, landmark, phone, hours).
   - Map widget showing store location.
   - "More from this store" recommendation rail.

**Expected result:**
- All sections render correctly.
- Media carousel swipe / dot indicators work.
- Phone numbers are tappable (`tel:`) links.
- Map shows store pin.

| Pass / Fail | Notes / Bug ID |
|---|---|
|   |   |

---

#### C-DET-02: Redeem a deal (QR claim flow)
**Pre-conditions:** Active deal, not previously claimed by this consumer.

**Steps:**
1. Open deal detail.
2. Tap **Get Before It's Gone!** (or **Redeem**) button at the bottom.
3. Wait for QR generation (~1–2 sec).
4. The QR voucher modal appears with: QR code, claim ID, instructions.
5. Show the QR to a merchant device for scanning.
6. After merchant scans, observe status update.

**Expected result:**
- QR is generated and visible.
- Claim ID is unique per claim.
- Once merchant scans + verifies, the consumer modal updates to **Verified**.
- Deal status changes to **Already Claimed** if attempting to re-redeem.

---

#### C-DET-03: Get directions to the store
**Steps:** From Store Info, tap **Get Directions**.

**Expected result:** Opens Google Maps (Android) or Apple Maps (iOS) with the store address pre-populated for navigation.

---

#### C-DET-04: Toggle favorite from detail page
**Steps:** Tap the heart icon at the top.

**Expected result:** Heart fills red. Deal added to **Favorites**. Toggle off un-favorites.

---

#### C-DET-05: Pin a deal
**Steps:** Tap the pin icon at the top.

**Expected result:** Pin fills blue. Deal added to **Pinned Deals** for that merchant.

---

#### C-DET-06: Read and write a review
**Pre-conditions:** Consumer has redeemed the deal previously.

**Steps:**
1. Scroll to Reviews section.
2. Tap **Write a Review**.
3. Pick a star rating (1–5).
4. Enter a comment.
5. Submit.

**Expected result:** Review appears in the list immediately. Star rating updates the deal's average rating.

---

#### C-DET-07: View consumer-side delivery info
**Pre-conditions:** Store has `delivers = true` and `delivery_radius_km = 5`.

**Steps:** Open deal detail.

**Expected result:** Below the category tag, see a green delivery card:
- Truck icon
- "Delivery available within 5 km" (or "City-wide delivery available" if radius ≥ 10).
- Disclaimer: "Delivered by the merchant or their partner; DealPro is not liable."

---

### Negative scenarios

#### C-DET-NEG-01: Try to redeem an expired deal
**Steps:** Open a deal whose end_date is yesterday.

**Expected result:** Redeem button is disabled with "This deal has expired." OR it is hidden entirely with an "Expired" banner.

#### C-DET-NEG-02: Try to redeem twice
**Steps:** Already redeemed once. Reopen the deal. Tap Redeem.

**Expected result:** Already Claimed popup shows status (Verified or Awaiting Merchant). No duplicate claim is created.

#### C-DET-NEG-03: Redeem fails on network
**Steps:** Tap Redeem. Kill network mid-request.

**Expected result:** Error toast "Could not generate voucher. Please try again." Retry works on network restore. No phantom claim is created.

#### C-DET-NEG-04: QR verification fails (QR scanned but merchant isn't valid)
**Steps:** Scan the QR with a wrong merchant device or modify the payload.

**Expected result:** Merchant scanner shows "Invalid voucher" or "Voucher belongs to a different store." Consumer's status stays "Awaiting Merchant."

#### C-DET-NEG-05: Deal description with HTML / scripts
**Steps:** Open a deal where the description contains `<script>` tags or other suspicious HTML (only possible if a merchant somehow injected it).

**Expected result:** Sanitization (`sanitizeHtml`) strips dangerous tags. Plain text + safe formatting survives. No script execution.

#### C-DET-NEG-06: Map widget fails to load
**Steps:** Block the OpenStreetMap tile URL via DevTools.

**Expected result:** Map area shows a placeholder ("Map unavailable"). Get Directions still works (uses raw address).

#### C-DET-NEG-07: Phone link doesn't open dialer
**Steps:** Tap the store phone number in Store Info.

**Expected result:** OS dialer opens with the number pre-filled. On desktop, prompts to launch calling app or copies the number.

#### C-DET-NEG-08: Deal with 0 free gifts
**Steps:** Open a regular (non-Buy & Get Free) deal.

**Expected result:** Free Gifts section is HIDDEN entirely. Not shown empty.

#### C-DET-NEG-09: Deal of the Day badge correctness
**Steps:** Open a DOTD.

**Expected result:** Yellow "Deal of the Day" badge visible at the top of the hero. Validity says "today only."

#### C-DET-NEG-10: Slow QR generation
**Steps:** On a slow network, tap Redeem.

**Expected result:** Redeem button shows a spinner state. Cannot be tapped twice in quick succession (debounced). QR appears when ready.

#### C-DET-NEG-11: Already-claimed consumer revisits the deal
**Steps:** A consumer who has already claimed the deal opens it again twice.

**Expected result:** First revisit just shows the "Already Claimed" status quietly. Second revisit pops the "Already Claimed" modal (because the visit-counter triggers it). Behavior should be polite, not spammy on every open.

#### C-DET-NEG-12: Image carousel with single image
**Steps:** Deal has only one image (no additional, no video).

**Expected result:** No nav arrows, no dot indicators. Single static image fills the hero.

#### C-DET-NEG-13: Review submission with empty comment
**Steps:** Pick stars, leave comment empty, Submit.

**Expected result:** Either accepted (star-only review) OR validation requires text. Document spec'd behavior.

#### C-DET-NEG-14: Profanity in review
**Steps:** Submit a review with profane text.

**Expected result:** AI moderation flags it; submission blocked with the named reason.

---

## 16. Consumer — Favorites / Pinned

Two related features:
- **Favorites** — heart-toggled deals shown in a dedicated screen.
- **Pinned** — pin-toggled deals (per merchant), prioritized in the personalized feed and recommendations.

### Happy path

#### C-FAV-01: View favorites list
**Pre-conditions:** Consumer has favorited 3 deals.

**Steps:** Bottom nav → **Favorites** (or via Profile menu).

**Expected result:**
- All 3 favorites listed in 2-col grid.
- Sorted by most-recently-favorited.
- Each card shows the same heading / image / offer as on home.

---

#### C-FAV-02: Un-favorite from the Favorites screen
**Steps:** Tap the heart on any favorited deal in the Favorites list.

**Expected result:** Card disappears from the list. The deal is also de-favorited everywhere else (home cards, deal detail).

---

#### C-FAV-03: Pin a deal
**Steps:** Open a deal detail → tap pin icon.

**Expected result:** Pin fills blue. Deal moves to top of "More from this store" rail. Personalized feed prioritizes this merchant's deals.

---

#### C-FAV-04: Un-pin a deal
**Steps:** Tap pin again on a pinned deal.

**Expected result:** Pin un-fills. Deal returns to normal position.

---

#### C-FAV-05: Pin tooltip shows on first-time use
**Steps:** Fresh consumer (cleared `deal_tooltips_shown` localStorage).

**Steps:**
1. Open any deal detail.
2. Wait ~500 ms.

**Expected result:** Tooltip appears: "Click to pin this deal." Auto-dismisses after ~10 seconds. Doesn't reappear next time (flag persisted in localStorage).

---

### Negative scenarios

#### C-FAV-NEG-01: Empty favorites
**Steps:** Open Favorites with no items.

**Expected result:** Empty state: "You haven't favorited anything yet — explore deals." with a CTA to go home. NOT a blank screen.

#### C-FAV-NEG-02: Favorite an expired deal
**Steps:** Favorite a deal. Wait until it expires. Open Favorites.

**Expected result:**
- Either the expired deal is hidden from Favorites, OR shown with an "Expired" badge.
- Tapping it shows the "This deal has expired" state.

#### C-FAV-NEG-03: Favorite while offline
**Steps:** Kill network. Tap heart on a deal.

**Expected result:** Either favorite optimistically updates and syncs when online, OR shows "Cannot favorite while offline." Document behavior.

#### C-FAV-NEG-04: Pin a deal whose store deletes itself
**Steps:** Pin a deal. Have the merchant delete the store.

**Expected result:** Pin survives but the deal's store info shows the soft-deleted state. App doesn't crash on detail open.

#### C-FAV-NEG-05: Favorite the same deal across two devices
**Steps:** Login as same consumer on Device A and B. Favorite a deal on A. Open Favorites on B.

**Expected result:** Favorite syncs. Appears on B within 30 seconds.

#### C-FAV-NEG-06: Pin limit (if any)
**Pre-conditions:** Document if there's a max number of pinned deals per consumer.

**Steps:** Pin up to and beyond the limit.

**Expected result:** If a limit exists, attempting to pin past it shows "Pin limit reached, remove a pinned deal first." Otherwise no limit applies.

#### C-FAV-NEG-07: Favorite count consistency
**Steps:** Cross-check favorite count badge (if any) vs the actual list count.

**Expected result:** Both numbers match.

---

## 17. Consumer — Profile

The Profile tab houses: account info, language, theme, location preferences, redemption history, friends, rewards, push notification settings, help, logout.

### Happy path

#### C-PROF-01: View and edit profile
**Steps:**
1. Profile tab → tap own name.
2. Edit name, optionally email.
3. Save.

**Expected result:** Save succeeds. Updated values persist.

---

#### C-PROF-02: Switch language
**Steps:** Profile → Language → pick Hindi.

**Expected result:** Whole consumer app re-renders in Hindi. Persists after restart.

---

#### C-PROF-03: Toggle theme
**Steps:** Profile → Theme toggle.

**Expected result:** Light / dark theme flips instantly. Persists.

---

#### C-PROF-04: View redemption history
**Steps:** Profile → My Redemptions.

**Expected result:**
- List of all past claims.
- Each entry shows deal heading, store, date, status (Verified / Pending / Expired).
- Tapping an entry shows details / receipt.

---

#### C-PROF-05: Friends — invite a friend
**Steps:** Profile → Friends → Invite.

**Expected result:**
- Share sheet opens with a deep link / referral code.
- After friend signs up via the link, both get rewards (per the rewards spec).

---

#### C-PROF-06: View rewards balance
**Steps:** Profile → Rewards.

**Expected result:** Shows current points balance and redemption history.

---

#### C-PROF-07: Notification preferences
**Steps:** Profile → Notifications → toggle categories (deals near me, friend activity, etc.).

**Expected result:** Settings save. Push notifications respect the toggles.

---

#### C-PROF-08: Logout
**Steps:** Profile → Logout → confirm.

**Expected result:** Returns to landing screen. Session cleared. Re-launch shows landing.

---

### Negative scenarios

#### C-PROF-NEG-01: Edit profile with invalid email
**Steps:** Profile → edit → email = "notanemail" → Save.

**Expected result:** Validation error. Save blocked.

#### C-PROF-NEG-02: Notification permission denied at OS
**Steps:** Toggle a notification category ON. Then deny notification permission at OS level.

**Expected result:** App detects the denial, surfaces a hint: "Enable notifications in OS settings to receive these." Does not crash.

#### C-PROF-NEG-03: Empty redemption history
**Steps:** Brand-new consumer with no claims → Profile → My Redemptions.

**Expected result:** Empty state: "No redemptions yet." Not a blank screen.

#### C-PROF-NEG-04: Friends — invite link doesn't open the app
**Steps:** Send an invite to a friend. Friend taps the link without DealPro installed.

**Expected result:** Link opens the app store / Play Store with DealPro pre-selected. After install, deep link should still attribute the referral.

#### C-PROF-NEG-05: Logout while a claim is in progress
**Steps:** Generate a QR voucher. Before merchant scans, tap Logout.

**Expected result:** Logout is either blocked OR proceeds with a warning. The active claim should still be valid for the merchant to verify on their side (claim is server-side state).

#### C-PROF-NEG-06: Untranslated string in consumer app
**Steps:** Walk through every consumer screen in each non-English language.

**Expected result:** Bug-track each English string that should be translated. Each is a separate S3 (Minor) bug.

#### C-PROF-NEG-07: Theme contrast issues
**Steps:** Switch to dark theme. Walk through every screen.

**Expected result:** All text legible (WCAG AA contrast minimum). No invisible icons, no white-on-white. Bug each instance found.

#### C-PROF-NEG-08: Rewards balance mismatch
**Steps:** Cross-check rewards balance against expected (sum of earned events).

**Expected result:** Numbers match. If they drift, file a bug with the discrepancy.

---

# End of test plan

This document covers **17 sections** with happy-path and negative test cases for both the Merchant and Consumer apps. Re-run the full plan as a regression suite for every release; pick subsets per feature area for targeted testing.

For new features added after this plan was written, add a new section following the same structure (Happy path → Negative scenarios → ID prefix). Keep the TOC and ID-prefix legend in sync.

---

## Quick reference — all test ID prefixes

| Prefix | Section | Count |
|---|---|---|
| `M-AUTH` | Merchant Authentication | 3 + 8 = 11 |
| `M-ONB` | Merchant Onboarding | 2 + 6 = 8 |
| `M-DEAL` | Merchant Regular Deal Wizard | 5 + 16 = 21 |
| `M-DOTD` | Merchant DOTD | 3 + 7 = 10 |
| `M-BGF` | Merchant Buy & Get Free | 2 + 5 = 7 |
| `M-STOR` | Merchant Stores Management | 5 + 9 = 14 |
| `M-PROD` | Merchant Product Catalogue | 4 + 8 = 12 |
| `M-DASH` | Merchant Dashboard | 5 + 6 = 11 |
| `M-CAMP` | Merchant My Campaigns | 6 + 9 = 15 |
| `M-SUB` | Merchant Subscriptions | 5 + 8 = 13 |
| `M-PROF` | Merchant Profile + Staff | 7 + 9 = 16 |
| `C-AUTH` | Consumer Authentication | 4 + 6 = 10 |
| `C-LOC` | Consumer Location | 4 + 7 = 11 |
| `C-HOME` | Consumer Deals Browse | 6 + 9 = 15 |
| `C-DET` | Consumer Deal Details + Redemption | 7 + 14 = 21 |
| `C-FAV` | Consumer Favorites / Pinned | 5 + 7 = 12 |
| `C-PROF` | Consumer Profile | 8 + 8 = 16 |
| **TOTAL** | | **~223 test cases** |





7. Merchant — Product Catalogue
8. Merchant — Dashboard / Analytics
9. Merchant — My Campaigns (renew, expired, ROI calculator)
10. Merchant — Subscriptions (trial, upgrade, downgrade, billing)
11. Merchant — Profile + Staff invites
12. Consumer — Authentication
13. Consumer — Location selection (auto-detect / manual / city filter)
14. Consumer — Deals browse (categories, search, personalized feed)
15. Consumer — Deal Details + Redemption (QR claim flow)
16. Consumer — Favorites / Pinned deals
17. Consumer — Profile (edit, language, logout)

---

## Conversion to Word

To turn this into a Word document:

**Option A — Paste:**
1. Open this file in a Markdown previewer (VS Code: `Ctrl+Shift+V`).
2. Select all → copy.
3. Paste into a fresh Word document. Tables, headings, and lists carry over.

**Option B — Pandoc (best fidelity):**
```bash
pandoc docs/TESTING.md -o docs/TESTING.docx --reference-doc=optional-template.docx
```

**Option C — VS Code extension:**
Install "Markdown PDF" or "Markdown to Word" extension and right-click the file → Export.
