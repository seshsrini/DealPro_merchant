-- campaign_create_gate: single-round-trip authorization gate for deal creation.
--
-- Replaces the 4 separate SELECTs the create-campaign edge function does today
-- (merchant role, active-staff, active-subscription, store-ownership) with one
-- RPC call. Under concurrency this roughly halves the DB round-trips per deal,
-- so each request holds a pooled connection for less time and the pool saturates
-- later (higher concurrency knee, lower tail latency).
--
-- Type note: this schema is mixed — merchant_profiles.id and merchant_staff.user_id
-- are real `uuid`s, but merchant_*.merchant_id columns are stored as `varchar`.
-- Params are therefore `text`, cast per-column to the column's actual type so the
-- relevant indexes are still used:
--   * uuid columns      -> compare against param::uuid   (uses the uuid/PK index)
--   * varchar merchant_id-> compare against the text param directly (binary-coercible)
--   * store ownership   -> the store is already pinpointed by its uuid PK, so the
--     merchant_id check is a single-row, type-agnostic verification.
--
-- All inputs are the authenticated caller's own ids (the edge function enforces
-- p_merchant_id = the JWT user, and p_user_id = the JWT user), and the function
-- only returns booleans — no row data leaks. SECURITY DEFINER so the checks are
-- not subject to per-table RLS; EXECUTE is restricted to authenticated callers.

drop function if exists public.campaign_create_gate(uuid, uuid, uuid);
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
      where ms.user_id = p_user_id::uuid and ms.status = 'active'
    ) as ok
  )
  select
    exists(
      select 1 from merchant_profiles mp
      where mp.id = p_user_id::uuid and mp.role = 'merchant'
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
      where st.id = p_store_id::uuid
        and st.merchant_id::text = p_merchant_id
    ) as store_ok;
$$;

revoke all on function public.campaign_create_gate(text, text, text) from public, anon;
grant execute on function public.campaign_create_gate(text, text, text) to authenticated, service_role;
