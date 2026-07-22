# PROD Setup Checklist (new Supabase projects)

Applies to both apps — consumer (`dev/dealpro`) and merchant (`MerchantDEV/dealpro`).
Work top to bottom; each section depends on the one above it.

---

## 0. Get the code into PROD folders — clone, don't copy-paste

Copying a working folder drags along `node_modules/`, `.git/` (whose remote still
points at the dev repo, so a stray push goes to the wrong place) and — most
dangerously — `.env.local` holding **DEV** credentials. A PROD build then silently
talks to the DEV database.

```bash
git clone <repo> C:\Srini\dealpro\MerchantPROD\dealpro
cd C:\Srini\dealpro\MerchantPROD\dealpro
git checkout -b prod          # or a release tag
npm install                   # fresh install, correct platform binaries
# author a NEW .env.local — do not copy the dev one
```

> Only two apps exist. Three PROD folders (`ConsumerPROD`, `MerchantPROD`,
> `MerchantWebPROD`) recreates the duplicate-repo ambiguity that already caused a
> full session of edits to land in a dead checkout. Prefer two.

---

## 1. Database schema — do NOT build from `scripts/schema-dump.sql`

That committed dump is **provably stale**: it is missing `merchant_profiles` and
`geocode_cache` entirely, and lacks the extended `merchant_stores` columns
(`store_category`, `store_phone`, `store_phone_alt`, `delivers`,
`delivery_radius_km`). Building PROD from it yields a database the code cannot run
against.

Take a fresh structural dump from the **live DEV** database instead:

```bash
pg_dump --schema-only --no-owner --no-privileges \
  "postgresql://postgres:<pw>@db.<dev-ref>.supabase.co:5432/postgres" \
  > prod-schema.sql
# review, then apply to the new PROD database
```

Afterwards, regenerate `scripts/schema-dump.sql` from the live DB so the committed
copy stops drifting.

---

## 2. Per-database settings (required before any trigger works)

The referral, trial-expiry and campaign-approval migrations now read the project
ref and service key from database settings instead of hardcoding them. Set these
**once per database**, on dev and prod:

```sql
ALTER DATABASE postgres SET app.settings.project_ref      = '<project-ref>';
ALTER DATABASE postgres SET app.settings.service_role_key = '<service-role-key>';
-- reconnect for the settings to take effect
```

If unset: the referral/campaign triggers skip their HTTP call with a warning (they
will never break the write that fired them), and the trial-expiry cron fails loudly.

---

## 3. Apply migrations

`supabase/migrations/` — all project refs are now parameterised, so they run
unchanged on any project.

**Do not run** `fix_new_deal_notification_on_insert.sql` (consumer repo). It is
guarded to abort on purpose; follow the instructions inside it.

---

## 4. Edge functions

Deploy from the canonical directory, and confirm the prod scripts target the new ref:

- Merchant: `scripts/deploy-functions-prod.ps1` / `.sh`
- Consumer: `supabase/deploy-public.ps1` (public functions need `--no-verify-jwt`)

> `scripts/deploy-fn-dev.ps1` and `deploy-fn-both.sh` hardcode the DEV ref — check
> before use.
>
> Beware any script that copies `supabase/<fn>` over `supabase/functions/<fn>` and
> then deletes it: that pattern is how the two `get-deals-of-day` copies drifted and
> how a stale function can overwrite a fixed one.

Then set function secrets in the PROD project (Settings → Edge Functions):
service role key, Firebase/FCM credentials, Cloudinary, Razorpay, etc.

---

## 5. Database webhooks / triggers — these do NOT come with the schema

Dashboard-created webhooks live outside migrations and carry **their own URL and
service_role key**. They must be recreated on PROD by hand.

- `new-deal-notification` on `public.campaigns` — recreate pointing at the **PROD**
  function URL with the **PROD** key.

Verify afterwards:

```sql
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'public.campaigns'::regclass and not tgisinternal;
```

Confirm no `<PROJECT_REF>` / `YOUR_` placeholder survives anywhere in the output.
A placeholder URL here fails every `campaigns` INSERT with libcurl error 21
("quote command returned error") — it has happened.

---

## 6. App environment

Create fresh `.env.local` in each PROD folder. Keys that **must** change:

| Key | Note |
|---|---|
| `VITE_SUPABASE_URL` | new PROD project |
| `VITE_SUPABASE_ANON_KEY` | new PROD anon key |
| `VITE_FIREBASE_*` | prod Firebase project (separate FCM sender = separate push tokens) |
| `VITE_GOOGLE_MAPS_API_KEY` | prod key, restricted to prod bundle id / domain |
| `VITE_GEMINI_API_KEY`, `VITE_SERPAPI_KEY` | prod quota keys |

Also review `capacitor.config.ts` (app id / name) and Razorpay keys — **live vs test
mode** is easy to miss.

### 6a. Billing lanes on vedicjaalam.com — mind the polarity

The web app already hosts two independent billing lanes. The naming is easy to read
backwards, so be explicit:

| URL | Supabase project | Razorpay keys | Use for |
|---|---|---|---|
| `/subscribe` | `NEXT_PUBLIC_SUPABASE_URL` | `RAZORPAY_KEY_ID` | **LIVE / prod** |
| `/test_subscribe` | `SUPABASE_TEST_URL` | `RAZORPAY_TEST_KEY_ID` | **TEST / dev** |
| `/merchant/subscribe` | live | live | LIVE manage |
| `/merchant/subscribe?test=1` | test | test | TEST manage |

`/subscribe` is the **live** lane — not the dev one. The lane is selected
server-side via `getSupabaseAdmin(test)` and the Razorpay test/live key pair
(`src/lib/supabase/admin.ts`, `src/lib/razorpay.ts`), so the lanes never share data
or keys.

**Both `VITE_SUBSCRIBE_URL` and `VITE_MANAGE_SUBSCRIPTION_URL` default to the LIVE
URLs when unset** — an unconfigured build charges real cards. Set them explicitly in
every environment (see `.env.example`).

For the new PROD project you must also point the web app's **live** lane at it:
update `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in the Vercel
project, and switch `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` to live-mode keys.
Leave `SUPABASE_TEST_*` pointing at DEV so the test lane keeps working.

---

## 7. Security

- **Rotate the `service_role` key.** A live one is committed in
  `scripts/schema-dump.sql`; it bypasses RLS entirely. Rotate the DEV key too — it
  is in git history.
- After rotating, update: database settings (§2), function secrets (§4), and any
  webhook Authorization header (§5), since each keeps its own copy.
- Confirm RLS policies came across with the schema and are enabled on every table
  holding user data.

---

## 8. Smoke test before go-live

1. Merchant signup end-to-end → profile row created, store row created.
2. Create a deal → publishes (this exercises the `campaign_create_gate` RPC and the
   campaigns trigger).
3. Edit a deal inside the 2-hour window.
4. Consumer: deals list populated; Deal of the Day populated for a known locality.
5. New-deal notification actually arrives on a device.
6. Subscription checkout in Razorpay **live** mode.
