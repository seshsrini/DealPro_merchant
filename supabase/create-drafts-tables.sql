-- ────────────────────────────────────────────────────────────────────────
-- Drafts tables — server-side persistence for in-flight wizards.
--
-- Lets a merchant pause a deal/DOTD/signup wizard, walk away (close the app,
-- attend to a customer, switch device), and resume exactly where they left off.
--
-- Design choices (see TESTING.md and the architecture discussion):
--   • One drafts table per "type" of wizard (campaign, signup), keyed by
--     merchant_id (campaign) or phone (signup).
--   • The wizard state is stored as a single JSONB `payload` column instead
--     of mirroring 30+ campaign columns — schema stays simple, wizard fields
--     can change without DB migrations.
--   • Image URLs are stored as separate columns (not inside the JSONB) so
--     a cleanup job can find orphaned Cloudinary uploads without parsing JSON.
--   • UNIQUE constraint enforces one in-flight draft per (merchant, kind);
--     a second start of the same wizard upserts onto the existing row.
-- ────────────────────────────────────────────────────────────────────────

-- ============ campaign_drafts ============
CREATE TABLE IF NOT EXISTS public.campaign_drafts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           uuid        NOT NULL REFERENCES public.merchant_profiles(id) ON DELETE CASCADE,
  kind                  text        NOT NULL CHECK (kind IN (
                                      'regular',
                                      'dotd',
                                      'buy_get_free_regular',
                                      'buy_get_free_dotd'
                                    )),
  current_step          int         NOT NULL DEFAULT 0,
  payload               jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Image references — kept out of the JSONB so the cleanup sweep can scan
  -- for orphaned Cloudinary uploads with a normal column query.
  cover_image_url       text,
  additional_image_urls text[]      NOT NULL DEFAULT '{}',
  free_gift_image_urls  text[]      NOT NULL DEFAULT '{}',

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT campaign_drafts_uq_merchant_kind UNIQUE (merchant_id, kind)
);

CREATE INDEX IF NOT EXISTS campaign_drafts_merchant_idx
  ON public.campaign_drafts (merchant_id);
CREATE INDEX IF NOT EXISTS campaign_drafts_updated_at_idx
  ON public.campaign_drafts (updated_at);

-- ============ signup_drafts ============
-- Keyed by the merchant's auth user ID. By the time the onboarding wizard runs,
-- the merchant has already completed phone+OTP and has a merchant_profiles row
-- with a JWT — so we can authenticate each draft request and prevent any cross-
-- account access. (Pre-OTP signup is just phone+OTP, no draftable state.)
CREATE TABLE IF NOT EXISTS public.signup_drafts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step  int         NOT NULL DEFAULT 0,
  payload       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_drafts_updated_at_idx
  ON public.signup_drafts (updated_at);

-- ============ updated_at trigger ============
-- Keep updated_at fresh on every UPSERT.
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS campaign_drafts_set_updated_at ON public.campaign_drafts;
CREATE TRIGGER campaign_drafts_set_updated_at
  BEFORE UPDATE ON public.campaign_drafts
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS signup_drafts_set_updated_at ON public.signup_drafts;
CREATE TRIGGER signup_drafts_set_updated_at
  BEFORE UPDATE ON public.signup_drafts
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ============ Row-Level Security ============
-- Edge functions use the service role and bypass RLS, so these policies are
-- defense-in-depth: if anyone ever queries with the user's anon JWT, they
-- can only touch their own row.

ALTER TABLE public.campaign_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchants_read_own_drafts"   ON public.campaign_drafts;
DROP POLICY IF EXISTS "merchants_modify_own_drafts" ON public.campaign_drafts;

CREATE POLICY "merchants_read_own_drafts"
  ON public.campaign_drafts
  FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "merchants_modify_own_drafts"
  ON public.campaign_drafts
  FOR ALL
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- signup_drafts: keyed by auth.users(id), so RLS is meaningful here too.
ALTER TABLE public.signup_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_signup_draft"   ON public.signup_drafts;
DROP POLICY IF EXISTS "users_modify_own_signup_draft" ON public.signup_drafts;

CREATE POLICY "users_read_own_signup_draft"
  ON public.signup_drafts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_modify_own_signup_draft"
  ON public.signup_drafts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============ Cleanup function ============
-- Run on a schedule via pg_cron to evict stale drafts. Admin must enable
-- pg_cron once at the project level:
--   create extension if not exists pg_cron;
--
-- Then schedule the cleanup (e.g. daily at 03:00 UTC):
--   select cron.schedule(
--     'drafts_cleanup_daily',
--     '0 3 * * *',
--     $$ select public.cleanup_stale_drafts(); $$
--   );

CREATE OR REPLACE FUNCTION public.cleanup_stale_drafts()
RETURNS TABLE (
  campaign_drafts_deleted int,
  signup_drafts_deleted   int
) AS $$
DECLARE
  c int;
  s int;
BEGIN
  WITH d AS (
    DELETE FROM public.campaign_drafts
    WHERE updated_at < now() - interval '30 days'
    RETURNING id
  )
  SELECT count(*)::int INTO c FROM d;

  WITH d AS (
    DELETE FROM public.signup_drafts
    WHERE updated_at < now() - interval '7 days'
    RETURNING id
  )
  SELECT count(*)::int INTO s FROM d;

  RETURN QUERY SELECT c, s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.cleanup_stale_drafts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_drafts() TO service_role;

-- ============ Sanity ============
-- After applying this migration, verify with:
--   select count(*) from public.campaign_drafts;  -- should be 0
--   select count(*) from public.signup_drafts;    -- should be 0
--   select * from public.cleanup_stale_drafts();  -- should return (0, 0)
