-- 1. Business registration is MANDATORY for every merchant: GSTIN, Udyam, FSSAI or
--    Trade Licence. There is no "none / unregistered" option.
-- 2. onboarding_complete is true only when EVERY onboarding step is done:
--    name, business name, business registration, Terms, Privacy AND an active
--    subscription (plan + payment). The database enforces it, whatever any app
--    version or function writes, and sets onboarding_step = 12 at that moment.
--
-- Run in BOTH DealFynd projects (DEV hyijwfovsvetpyrbqfcd, PROD trrinhrajmsnkjnwtncz)
-- AFTER create-campaign and complete-merchant-profile have been redeployed.
-- Safe to re-run. One transaction.

begin;

-- ── Shared rule: does this profile carry a business registration? ──────────
create or replace function public.merchant_has_business_doc(
  p_business_type text, p_gstin text, p_udyam text, p_fssai text, p_trade text
) returns boolean
language sql immutable
as $$
  select coalesce(
       (p_business_type = 'gstin'         and coalesce(p_gstin, '') <> '')
    or (p_business_type = 'udyam'         and coalesce(p_udyam, '') <> '')
    or (p_business_type = 'fssai'         and coalesce(p_fssai, '') <> '')
    or (p_business_type = 'trade_license' and coalesce(p_trade, '') <> ''),
  false);
$$;

-- ── Deal creation gate (create_campaign_gate_rpc.sql + has_business_doc) ─────
-- has_access now also requires the owner's registration, so NO endpoint or app
-- version can create a deal without one; create-campaign checks has_business_doc
-- first to show a clear message.
drop function if exists public.campaign_create_gate(text, text, text);

create or replace function public.campaign_create_gate(
  p_user_id text,
  p_merchant_id text,
  p_store_id text
)
returns table (
  is_merchant boolean,
  is_staff boolean,
  has_access boolean,
  store_ok boolean,
  has_business_doc boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with staff as (
    select exists(
      select 1 from merchant_staff ms
      where ms.user_id = p_user_id::uuid and ms.status = 'active'
    ) as ok
  ),
  doc as (
    select exists(
      select 1 from merchant_profiles o
      where o.id = p_merchant_id::uuid
        and public.merchant_has_business_doc(o.business_type, o.gstin, o.udyam_no, o.fssai_no, o.trade_license_no)
    ) as ok
  )
  select
    exists(
      select 1 from merchant_profiles mp
      where mp.id = p_user_id::uuid and mp.role = 'merchant'
    ) as is_merchant,
    (select ok from staff) as is_staff,
    (
      (select ok from doc)
      and (
        (select ok from staff)
        or exists(
          select 1 from merchant_subscriptions s
          where s.merchant_id = p_merchant_id
            and s.status = 'active'
            and s.current_period_end >= now()
        )
      )
    ) as has_access,
    exists(
      select 1 from merchant_stores st
      where st.id = p_store_id::uuid
        and st.merchant_id::text = p_merchant_id
    ) as store_ok,
    (select ok from doc) as has_business_doc;
$$;

revoke all on function public.campaign_create_gate(text, text, text) from public, anon;
grant execute on function public.campaign_create_gate(text, text, text) to authenticated, service_role;

-- ── onboarding_complete: only after every step ───────────────────────────────
-- Eligible = all signup steps saved + registration + an active subscription.
create or replace function public.merchant_onboarding_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eligible boolean;
begin
  eligible :=
        coalesce(trim(new.full_name), '') <> ''
    and coalesce(trim(new.store_name), '') <> ''
    and new.terms_accepted is true
    and new.privacy_accepted is true
    and public.merchant_has_business_doc(new.business_type, new.gstin, new.udyam_no, new.fssai_no, new.trade_license_no)
    and exists (
      select 1 from merchant_subscriptions s
      where s.merchant_id = new.id::text
        and s.status = 'active'
        and s.current_period_end >= now()
    );

  if eligible and new.onboarding_complete is not true then
    new.onboarding_complete := true;
    new.onboarding_step := 12;
    new.onboarding_step_at := now();
  elsif not eligible and new.onboarding_complete is true
        and (tg_op = 'INSERT' or old.onboarding_complete is not true) then
    -- Someone tried to mark an unfinished signup complete — refuse.
    new.onboarding_complete := false;
  end if;
  -- (A merchant who completed once stays complete if their plan later lapses.)
  return new;
end;
$$;

drop trigger if exists merchant_onboarding_guard on public.merchant_profiles;
create trigger merchant_onboarding_guard
  before insert or update on public.merchant_profiles
  for each row execute function public.merchant_onboarding_guard();

-- When a subscription turns active, re-evaluate that merchant (the guard above
-- decides; this only nudges the row).
create or replace function public.merchant_subscription_completes_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.current_period_end >= now() then
    update merchant_profiles
       set onboarding_complete = true
     where id::text = new.merchant_id
       and onboarding_complete is not true;
  end if;
  return new;
end;
$$;

drop trigger if exists merchant_subscription_completes_onboarding on public.merchant_subscriptions;
create trigger merchant_subscription_completes_onboarding
  after insert or update of status, current_period_end on public.merchant_subscriptions
  for each row execute function public.merchant_subscription_completes_onboarding();

-- ── Correct existing rows ────────────────────────────────────────────────────
-- Marked complete but never finished: no registration, or never subscribed.
update public.merchant_profiles mp
   set onboarding_complete = false
 where mp.onboarding_complete is true
   and (
        not public.merchant_has_business_doc(mp.business_type, mp.gstin, mp.udyam_no, mp.fssai_no, mp.trade_license_no)
     or not exists (select 1 from merchant_subscriptions s where s.merchant_id = mp.id::text)
   );

-- Finished everything but not yet marked: the guard sets true + step 12.
update public.merchant_profiles mp
   set onboarding_complete = true
 where mp.onboarding_complete is not true
   and exists (select 1 from merchant_subscriptions s
               where s.merchant_id = mp.id::text and s.status = 'active' and s.current_period_end >= now());

commit;

-- ── Report ───────────────────────────────────────────────────────────────────
-- Merchants who must add a registration (they see "Business registration
-- required" on next login and cannot create deals until they do):
select mp.store_name, mp.full_name, mp.phone, mp.business_type, mp.onboarding_complete,
       exists(select 1 from merchant_subscriptions s
              where s.merchant_id = mp.id::text and s.status = 'active' and s.current_period_end >= now()) as subscribed
from public.merchant_profiles mp
where coalesce(mp.role, 'merchant') = 'merchant'
  and coalesce(mp.full_name, '') <> ''
  and not public.merchant_has_business_doc(mp.business_type, mp.gstin, mp.udyam_no, mp.fssai_no, mp.trade_license_no)
order by mp.created_at desc;
