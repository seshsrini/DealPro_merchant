-- Robust staff lockout gate.
--
-- merchant_is_active_actor(user_id) → may this auth user act in the merchant app
-- right now? Used by every sensitive edge function + login + the client poll so a
-- suspended (disabled/resigned) staff member is blocked server-side even with a
-- still-valid JWT.
--
-- Subtlety this handles: a trigger (auto_create_merchant_owner) gives EVERY user —
-- including a pure staff member — an ACTIVE self-owner row (merchant_id = user_id).
-- So "has any active row" is always true and cannot distinguish a real owner from a
-- disabled employee. We instead use the real signal:
--   * A genuine merchant owns a store OR holds an ACTIVE manager/staff membership.
--   * A disabled employee has a SUSPENDED manager/staff membership and neither of
--     the above → BLOCKED.
-- Everyone else (a brand-new owner with no store yet, a normal owner) → allowed.
create or replace function public.merchant_is_active_actor(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with sig as (
    select
      exists (
        select 1 from public.merchant_stores where merchant_id = p_user_id
      ) as owns_store,
      exists (
        select 1 from public.merchant_staff
        where user_id = p_user_id and role in ('manager','staff') and status = 'active'
      ) as active_member,
      exists (
        select 1 from public.merchant_staff
        where user_id = p_user_id and role in ('manager','staff') and status = 'suspended'
      ) as suspended_member
  )
  select case
    when owns_store or active_member then true   -- a real merchant / active staff
    when suspended_member then false             -- disabled employee, no own store
    else true                                    -- normal/new owner
  end
  from sig;
$$;

-- Edge functions call this with the anon+JWT client (role authenticated) or the
-- service-role client, so grant execute to both. security definer means the body
-- reads merchant_staff/merchant_stores regardless of the caller's own RLS.
grant execute on function public.merchant_is_active_actor(uuid) to authenticated, anon, service_role;
