-- billing_sessions — signed-in access to the web subscription pages.
--
-- The app asks issue-billing-pass for a one-time pass (10 min) and opens
-- vedicjaalam.com/merchant/subscribe?pass=…; the website swaps it for a browser
-- session cookie (60 min). Only SHA-256 hashes are stored — never the pass or
-- the cookie value. Plan changes / cancels then use the merchant from the
-- session instead of a merchant_id in the link.
--
-- Run in BOTH DealFynd projects (DEV hyijwfovsvetpyrbqfcd, PROD trrinhrajmsnkjnwtncz).
-- Safe to re-run. Service-role only (RLS on, no policies).

create table if not exists public.billing_sessions (
  id                 uuid primary key default gen_random_uuid(),
  merchant_id        uuid not null,
  issued_to          uuid not null,          -- auth user who asked (owner, or staff with subscription.manage)
  pass_hash          text not null unique,   -- sha256(hex) of the one-time pass in the URL
  pass_expires_at    timestamptz not null,
  pass_used_at       timestamptz,
  session_hash       text unique,            -- sha256(hex) of the browser cookie value
  session_expires_at timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists idx_billing_sessions_merchant on public.billing_sessions (merchant_id);

alter table public.billing_sessions enable row level security;
revoke all on public.billing_sessions from anon, authenticated;
