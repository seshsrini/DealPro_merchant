# Server-side Drafts — deployment + tester checklist

The drafts feature lets a merchant pause the deal/DOTD/onboarding wizard and resume on the same OR a different device. State is persisted to the server in two new tables:
- `campaign_drafts` — for regular deals + DOTD + Buy & Get Free (in either flow), keyed by `merchant_id` + `kind`.
- `signup_drafts` — for the merchant onboarding wizard, keyed by `user_id`.

Cover and additional images are uploaded to a dedicated `dealpro-drafts/` Cloudinary folder so they survive across sessions; on **Start Over** they're destroyed; on **Publish** they remain (now referenced by the published deal). On **Publish**, the draft row itself is deleted.

---

## Deployment steps (in this order)

### 1. Apply the SQL migration

```bash
# From a DB client connected to the project:
psql "$SUPABASE_DB_URL" -f supabase/create-drafts-tables.sql
```

This creates:
- `public.campaign_drafts` + `public.signup_drafts` tables
- Triggers to auto-update `updated_at`
- RLS policies (merchants see only their own rows)
- `public.cleanup_stale_drafts()` function (must be scheduled separately — see step 4)

Verify:
```sql
SELECT count(*) FROM public.campaign_drafts;  -- 0
SELECT count(*) FROM public.signup_drafts;    -- 0
SELECT * FROM public.cleanup_stale_drafts();  -- (0, 0)
```

### 2. Deploy the three new edge functions

```bash
supabase functions deploy manage-draft
supabase functions deploy manage-signup-draft
supabase functions deploy cloudinary-destroy
```

`cloudinary-destroy` requires three env vars set as Supabase project secrets:
```bash
supabase secrets set CLOUDINARY_CLOUD_NAME=...
supabase secrets set CLOUDINARY_API_KEY=...
supabase secrets set CLOUDINARY_API_SECRET=...
```
(These are the same vars `cloudinary-sign` uses — likely already set.)

### 3. Deploy the client

```bash
npm run build
# then deploy the dist/ as usual
```

### 4. Schedule the cleanup cron (one-time)

In the Supabase SQL editor:

```sql
-- Enable pg_cron once (admin operation)
create extension if not exists pg_cron;

-- Schedule the daily sweep at 03:00 UTC
select cron.schedule(
  'drafts_cleanup_daily',
  '0 3 * * *',
  $$ select public.cleanup_stale_drafts(); $$
);
```

This evicts:
- `campaign_drafts` rows older than 30 days
- `signup_drafts` rows older than 7 days

Note: the sweep deletes ROWS only. Cloudinary `dealpro-drafts/` assets are NOT destroyed by the sweep — they're either referenced by a published deal (kept) or were already destroyed by a prior Start Over. If Cloudinary storage grows, run a separate one-shot script to destroy all `dealpro-drafts/*` assets older than 60 days that aren't referenced in `campaigns.image_url` or `campaigns.media_urls`.

---

## What the developer verified (without running the app)

- ✅ SQL syntax — schema valid, FK + UNIQUE + RLS clauses well-formed.
- ✅ Edge function structure — all three follow the existing project pattern (`manage-draft`, `manage-signup-draft`, `cloudinary-destroy`).
- ✅ Client service `draftService.ts` — debounce uses `setTimeout` with mutex, flush + cancel methods cover the lifecycle.
- ✅ All `campaignDraftService.delete(...)` call sites pass the correct `kind` derived from `isBuyGetFreeMode`.
- ✅ All `addCampaignService.destroyDraftImages(...)` calls pass only the URLs from the delete response — no risk of destroying production images.
- ✅ `MerchantOnboarding` race fixed — `determineStartStep` now uses `Math.max` so the server draft's `current_step` isn't clobbered.
- ✅ `StepImage.handleContinue` upload-to-drafts only fires AFTER moderation passes — flagged images are never uploaded.

## What the developer could NOT verify (please test)

The dev environment can't actually exercise the wizard end-to-end, so each of the following must be smoke-tested on a real device.

---

## Tester checklist

### A. Campaign Drafts — happy path

| # | Test | Expected | Pass/Fail |
|---|---|---|---|
| A-1 | Open New Deal, fill Heading + Offer, tap Start Over | Draft row in `campaign_drafts` is gone (verify via `select * from campaign_drafts where merchant_id='<your id>'`) | |
| A-2 | Open New Deal, walk Steps 1→4 (Image included), close the app | Draft row exists with `current_step=4`, `cover_image_url` is a `…/dealpro-drafts/…` URL | |
| A-3 | Reopen app within 30 days, tap New Deal | "You have an unfinished deal — '<heading>' — last edited <time>" modal appears | |
| A-4 | Tap **Resume** | Wizard jumps to step 4, all fields restored, cover image visible | |
| A-5 | From Step 4, complete the wizard and Publish | Deal published successfully; draft row gone; published deal's image is the same `dealpro-drafts/…` URL | |
| A-6 | Re-open New Deal | No resume modal (draft was deleted on publish) | |

### B. Campaign Drafts — Start Over

| # | Test | Expected | Pass/Fail |
|---|---|---|---|
| B-1 | Open New Deal, walk to Image step, upload a photo | Photo appears as cover. Upload spinner runs ~2-5s longer than before (drafts upload happens here). | |
| B-2 | Continue past Image step, then tap **Start Over** + confirm | Wizard resets. Verify in Cloudinary console: the `dealpro-drafts/<filename>` asset has been destroyed. | |
| B-3 | Re-open New Deal | No resume modal | |

### C. Campaign Drafts — cross-device

| # | Test | Expected | Pass/Fail |
|---|---|---|---|
| C-1 | On Phone A, start a deal, fill 3 steps, close app (don't Publish) | Draft row exists | |
| C-2 | On Phone B (logged in as same merchant), open New Deal | Resume modal appears showing Phone A's draft | |
| C-3 | Tap Resume on Phone B | Same step + content as Phone A had | |
| C-4 | On Phone B, complete + Publish | Published successfully; draft gone everywhere | |
| C-5 | On Phone A, open New Deal | No resume modal | |

### D. Campaign Drafts — DOTD parity

Repeat A-1 through B-3 for **Deal of the Day** wizard (use Buy & Get Free template once each to also cover those kinds).

### E. Signup Drafts (Onboarding)

| # | Test | Expected | Pass/Fail |
|---|---|---|---|
| E-1 | Sign up as a brand-new merchant (use a fresh phone number). Complete OTP. | Lands on Onboarding Step 0 (Welcome). | |
| E-2 | Type Full Name. Tap Next. | Server draft row exists in `signup_drafts` with `current_step=2`. | |
| E-3 | Type Store Name. Tap Next. | Draft row updates with `current_step=3` (or whatever). | |
| E-4 | Close the app. Reopen. | Onboarding resumes at the same step. Name + Store Name still typed. | |
| E-5 | Walk through to final submit. | Submit succeeds; `signup_drafts` row gone; merchant lands on Dashboard. | |
| E-6 | Re-open the app | Lands on Dashboard (not onboarding). | |

### F. Negative scenarios

| # | Test | Expected | Pass/Fail |
|---|---|---|---|
| F-1 | Open New Deal while offline | App still works. Resume modal does NOT appear (load failed silently). Wizard works from blank. | |
| F-2 | Start a deal, kill network, walk steps | localStorage saves still work. No errors visible to the merchant. When network restores, next save catches up. | |
| F-3 | Start a deal, immediately Start Over | Server may not have the row yet (debounce in flight). Delete still succeeds (cancel pending save fires first; row may not exist). No errors. | |
| F-4 | Tap Resume, then Start Over | Both Resume and Start Over delete-paths run cleanly without errors. | |
| F-5 | Have JWT expire mid-wizard (manually clear refresh token) | The 4-min heartbeat + visibility-on-resume refresh keep token alive. If still expired at save, debounced save fails silently — localStorage still works. | |
| F-6 | Two browser tabs, same merchant, both open New Deal at the same time | UNIQUE constraint on (merchant_id, kind) means whichever saves last wins. No crash, no duplicate rows. | |
| F-7 | Resume a draft whose `cover_image_url` was manually deleted from Cloudinary | Wizard resumes; cover slot shows the broken image fallback. Merchant can re-upload. | |
| F-8 | Run `select * from cleanup_stale_drafts()` after backdating a draft's `updated_at` to 35 days ago | Returns `(1, 0)` (1 campaign draft deleted, 0 signup) | |

### G. Verifying Cloudinary cleanup

In the Cloudinary console, navigate to the `dealpro-drafts/` folder.

| # | Test | Expected | Pass/Fail |
|---|---|---|---|
| G-1 | Note the asset count. Start Over a deal that had 2 uploaded images. | Asset count drops by 2 within seconds. | |
| G-2 | Publish a deal that had 2 uploaded images. | Asset count UNCHANGED (assets remain — published deal references them). | |
| G-3 | Check Supabase function logs for `cloudinary-destroy` after a Start Over | No errors. Each destroyed URL listed in the response. | |

---

## Files changed in this delivery

**New:**
- `supabase/create-drafts-tables.sql`
- `supabase/manage-draft/index.ts`
- `supabase/manage-signup-draft/index.ts`
- `supabase/cloudinary-destroy/index.ts`
- `services/draftService.ts`
- `docs/DRAFTS_DEPLOYMENT_AND_TESTING.md` (this file)

**Modified:**
- `services/addCampaignService.ts` — added `uploadDealImageDraft`, `destroyDraftImages`, optional `folderOverride` on `uploadDealImage`.
- `components/campaign-wizard/StepImage.tsx` — new `merchantId` prop; uploads files to `dealpro-drafts/` after moderation passes; converts File state to URL state.
- `CampaignWizard.tsx` — load draft on mount with Resume/Start fresh modal; debounced server save in `saveDraft`; delete draft on publish + Start Over (with Cloudinary destroy on Start Over only); pass `merchantId` to StepImage.
- `DotdWizard.tsx` — same pattern as CampaignWizard.
- `MerchantOnboarding.tsx` — load `signup_drafts` on mount and merge typed-but-unsaved fields; debounced server save; delete draft on final submit; race-fix for `determineStartStep` (use `Math.max`).

## Known limitations / accepted trade-offs

1. **Replacing the cover image mid-wizard orphans the previous draft URL** — the `dealpro-drafts/` upload happens at Continue but the URL replacement isn't preceded by a `destroyDraftImages` call for the old URL. The 30-day cleanup cron will eventually evict orphan rows, but the Cloudinary asset itself stays unless someone runs the orphan-asset sweep. Tracked as a v1.1 cleanup.
2. **Signup draft `payload` may overwrite freshly-edited profile fields** — if the merchant logs in on Device B mid-onboarding and edits profile on Device A simultaneously, last-write-wins. No conflict UI.
3. **No "Draft saved" indicator pill** — the architecture supports it (track `updated_at` from save responses) but the UI was scoped out for v1.
