# Razorpay Native Subscriptions — Deploy & Test Runbook

How the new merchant subscription system is wired, how to deploy it, and the
exact test matrix. Supersedes the old custom charge-at-will billing for **new**
subscribers (the legacy run still serves un-migrated token-mandate merchants).

---

## 1. Architecture (who does what)

| Concern | Owner |
|---|---|
| Recurring schedule (monthly/yearly), each charge | **Razorpay** (native Subscriptions, `plan_id`-based) |
| Create subscription + first-charge authorisation | VedicJaalam `/subscribe` → `/api/razorpay/create-subscription` → `/api/razorpay/verify-subscription` |
| Lifecycle reconciliation (active / charged / cancelled / halted) | `razorpay-webhook` edge function (source of truth → `merchant_subscriptions`) |
| Upgrade / downgrade / cancel | `merchant-subscription` EF → Razorpay `PATCH` / `cancel` |
| Legacy token-mandate subscribers (un-migrated) | VedicJaalam `/api/billing/run` (custom run) — **skips** any row with `razorpay_subscription_id` |

**Billing model:** full tier amount from month 1 (no trial, no free months). Yearly = one charge at signup covers 12 months. Loyalty (redemption partner) is a **free** feature for everyone — no paid add-on.

**Charge timing:** upgrade = prorated charge now + instant benefit (`schedule_change_at:'now'`); downgrade = applies next cycle (`'cycle_end'`); cancel = at period end; monthly↔yearly = cancel old + re-subscribe.

---

## 2. One-time setup

1. **Apply migrations** (DEV `gkulyxglzqlhpqxlwjqw`, then PROD `lpypcdshtiwkxkelepnl`):
   - `00010_razorpay_plan_ids.sql` — Razorpay columns, UNIQUE `razorpay_subscription_id` index, `razorpay_webhook_events`.
   - `00011_loyalty_free_for_all.sql` — loyalty default true + backfill.
   - `00019_seed_subscription_tiers.sql` — canonical tiers + `sort_order`.
2. **Create a Razorpay Plan per active tier** in the dashboard (matching currency, interval, amount in paise), then:
   ```sql
   UPDATE subscription_tiers SET razorpay_plan_id = 'plan_xxx' WHERE tier_key = 'basic_monthly';
   UPDATE subscription_tiers SET razorpay_plan_id = 'plan_xxx' WHERE tier_key = 'platinum_monthly';
   UPDATE subscription_tiers SET razorpay_plan_id = 'plan_xxx' WHERE tier_key = 'unlimited_monthly';
   UPDATE subscription_tiers SET razorpay_plan_id = 'plan_xxx' WHERE tier_key = 'premium_yearly';
   ```
   > Until set, that tier's Subscribe button is disabled in live mode, and `change_tier` returns 400 for it.
3. **Function secrets** (project-wide; already present per the secrets screen — verify they're test keys on DEV):
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
4. **VedicJaalam env** (Vercel): `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, Supabase service role. Optional: `RAZORPAY_MOCK_MODE=true` (+ `NEXT_PUBLIC_RAZORPAY_MOCK_MODE`) for mock testing.
5. **Razorpay dashboard → Webhooks:** URL `https://<ref>.functions.supabase.co/razorpay-webhook`, set the secret = `RAZORPAY_WEBHOOK_SECRET`, subscribe to: `subscription.authenticated/activated/charged/completed/cancelled/paused/resumed/halted` (+ `payment.captured/failed`).

---

## 3. Deploy

```bash
# Edge functions (DEV ref shown; swap for PROD)
supabase functions deploy razorpay-webhook      --no-verify-jwt --project-ref gkulyxglzqlhpqxlwjqw
supabase functions deploy merchant-subscription                  --project-ref gkulyxglzqlhpqxlwjqw
supabase functions deploy verify-subscription                    --project-ref gkulyxglzqlhpqxlwjqw
supabase functions deploy get-tiers                              --project-ref gkulyxglzqlhpqxlwjqw
# (manage-subscription only if you still use sync_from_device)
```
- **VedicJaalam:** push → Vercel deploys the `/subscribe` page + `/api/razorpay/*` routes.
- **Merchant app:** rebuild the APK (point DEV at a DEV-wired `/subscribe` via `VITE_SUBSCRIBE_URL` if needed).

---

## 4. Test matrix

Run in order: **mock → Razorpay test → (later) live**.

> Mock mode (`RAZORPAY_MOCK_MODE=true`) skips real Razorpay + signature checks and works **without** `razorpay_plan_id` — good for the signup→active path. Upgrade/downgrade/cancel hit Razorpay's real API even in "mock" (the EF has no mock), so test those with **test keys + real test plan ids**.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | **Signup** | Onboard → pick tier → StepPayment → Pay | Row `status=active`, `razorpay_subscription_id` set, `razorpay_token_id` null; app shows Active. |
| 2 | **Webhook charged** | Trigger/await `subscription.charged` | `current_period_end` advances; `merchant_payments` ledger row added; idempotent on retry. |
| 3 | **Upgrade** (same freq) | Subscriptions → pick higher tier → confirm | Razorpay `PATCH now`; prorated charge; plan_name + limits flip immediately; lock set. |
| 4 | **Downgrade** (same freq) | pick lower tier | Razorpay `PATCH cycle_end`; `pending_*` set; plan stays until cycle end; webhook applies it on next charge. |
| 5 | **Monthly↔yearly** | pick a different-frequency tier | EF returns `resubscribe`; app opens checkout; on activation the old subscription is cancelled at Razorpay. |
| 6 | **Cancel** | Cancel → reason | `cancel_at_period_end=true`, Razorpay `cancel_at_cycle_end:1`; access until period end; `subscription.cancelled` flips status at end. |
| 7 | **Change lock** | try changing again right after #3/#4 | Blocked with the "change again after <date>" message. |
| 8 | **Legacy guard** | run `/api/billing/run` while a native sub exists | Native sub NOT charged (excluded); only legacy token rows are. |
| 9 | **Legacy migration** | as a legacy/Play-trial merchant, tap "Set up Autopay" | Opens checkout; becomes native; billing run skips them afterward. |
| 10 | **Halted** | simulate failed renewal → `subscription.halted` | status `halted`, access revoked. |

---

## 5. Safety / rollback notes

- The custom billing run + admin billing console **exclude** rows with a `razorpay_subscription_id`, so native and legacy subscribers can't both be charged. This holds in mock mode too.
- `change_tier` / `cancel` abort with **502 and no DB mutation** if the Razorpay call fails — the DB never drifts ahead of Razorpay.
- `force-due` rejects native subs (they're Razorpay-driven).
- **P3 remaining:** once all legacy token-mandate subscribers have migrated (or churned), retire `/api/billing/run` + the mandate-charge code path.
