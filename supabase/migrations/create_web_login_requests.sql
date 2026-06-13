-- web_login_requests — backs the "approve web login from your phone" flow.
--
-- Flow: a merchant entering their phone on vedicjaalam.com/merchant/ creates a
-- PENDING row here (via the unauthenticated `web-login-request` edge function).
-- Their already-logged-in mobile app lists + APPROVES it (via the authenticated
-- `web-login-approve` edge function), which stamps a single-use magic-link
-- token_hash on the row. The web client then CLAIMS that token_hash (proving it
-- is the original requester with claim_nonce) and verifies it into a Supabase
-- session — same mechanism as login-merchant, but gated by the logged-in phone
-- instead of an SMS OTP.

create table if not exists public.web_login_requests (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references auth.users(id) on delete cascade,
  phone           text not null,
  request_code    text not null,                    -- 4-digit code shown on BOTH web and mobile so the merchant confirms it's the same login
  claim_nonce     text not null,                    -- secret returned only to the web requester; required to claim the session
  status          text not null default 'pending',  -- pending | approved | denied | claimed | expired
  token_hash      text,                             -- magic-link hash; set on approval, cleared on claim (single-use)
  requester_label text,                             -- e.g. "Chrome · Windows" — shown in the mobile approval prompt
  approved_by     uuid,                             -- auth user who approved (must equal merchant_id)
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

create index if not exists idx_wlr_merchant_status on public.web_login_requests (merchant_id, status);
create index if not exists idx_wlr_expires on public.web_login_requests (expires_at);

-- All access goes through the service-role edge functions, which enforce the
-- nonce (web) and JWT ownership (mobile) checks themselves. Enable RLS with NO
-- policies so anon/authenticated clients can never read token_hash / claim_nonce
-- directly off the table.
alter table public.web_login_requests enable row level security;
