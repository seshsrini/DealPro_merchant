-- PrismIQ read-only analytics role — the credentials Cube connects with.
-- Run in the Supabase SQL editor (as the default postgres role). DEV first, PROD at cutover.

-- 1) Login role. CHANGE the password to something strong; you'll paste it into Cube.
create role prismiq_readonly with login password 'CHANGE_ME_TO_A_STRONG_PASSWORD';

-- 2) Read-only access to ONLY the analytics tables (least privilege — no write grants).
grant usage on schema public to prismiq_readonly;
grant select on
  public.campaigns,
  public.campaign_interactions,
  public.merchant_subscriptions,
  public.subscription_tiers,
  public.merchant_profiles,
  public.merchant_stores,
  public.user_profiles,
  public.consumer_rewards,
  public.contractor_codes,
  public.products,
  public.merchant_payments
to prismiq_readonly;

-- 3) PrismIQ is admin/owner-only, read-only, and reports across ALL merchants, so the
--    role must see every row. Let it bypass RLS for these reads.
--    If Supabase rejects this line (insufficient privilege), DON'T force it — ping me and
--    I'll switch to RLS-exempt analytics views instead (owned by postgres, granted to this role).
alter role prismiq_readonly bypassrls;

-- Cube connection (Supabase → Settings → Database → Connection string, Session pooler):
--   host = aws-0-<region>.pooler.supabase.com   port = 5432 (or 6543 txn pooler)
--   database = postgres   user = prismiq_readonly.<project-ref>   password = (the one above)
