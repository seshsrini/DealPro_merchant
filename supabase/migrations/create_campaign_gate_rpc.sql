-- campaign_create_gate: single-round-trip authorization gate for deal creation.
--
-- Replaces the 4 separate SELECTs the create-campaign edge function does today
-- (merchant role, active-staff, active-subscription, store-ownership) with one
-- RPC call. Under concurrency this roughly halves the DB round-trips per deal,
-- so each request holds a pooled connection for less time and the pool saturates
-- later (higher concurrency knee, lower tail latency).
--
-- All inputs are the authenticated caller's own ids (the edge function enforces
-- p_merchant_id = the JWT user, and p_user_id = the JWT user), and the function
-- only returns booleans — no row data leaks. SECURITY DEFINER so the checks are
-- not subject to per-table RLS; EXECUTE is restricted to authenticated callers.

create or replace function public.campaign_create_gate(
  p_user_id uuid,
  p_merchant_id uuid,
  p_store_id uuid
)
returns table (
  is_merchant boolean,
  is_staff boolean,
  has_access boolean,
  store_ok boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with staff as (
    select exists(
      select 1 from merchant_staff ms
      where ms.user_id = p_user_id and ms.status = 'active'
    ) as ok
  )
  select
    exists(
      select 1 from merchant_profiles mp
      where mp.id = p_user_id and mp.role = 'merchant'
    ) as is_merchant,
    (select ok from staff) as is_staff,
    (
      (select ok from staff)
      or exists(
        select 1 from merchant_subscriptions s
        where s.merchant_id = p_merchant_id
          and s.status = 'active'
          and s.current_period_end >= now()
      )
    ) as has_access,
    exists(
      select 1 from merchant_stores st
      where st.id = p_store_id and st.merchant_id = p_merchant_id
    ) as store_ok;
$$;

revoke all on function public.campaign_create_gate(uuid, uuid, uuid) from public, anon;
grant execute on function public.campaign_create_gate(uuid, uuid, uuid) to authenticated, service_role;
