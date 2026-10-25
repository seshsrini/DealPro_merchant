-- Per-store WhatsApp chat opt-in ("Chat with merchant" on the consumer deal page).
-- Run in BOTH DealFynd projects (DEV hyijwfovsvetpyrbqfcd, PROD trrinhrajmsnkjnwtncz)
-- BEFORE deploying the updated get-one / get-all / get-deals-of-day / manage-stores /
-- complete-merchant-profile functions. Safe to re-run.
--
-- The number itself is the existing merchant_stores.store_phone, which the merchant
-- app now labels "Store WhatsApp number". Consumers only see the chat button when
-- whatsapp_chat_enabled is true. Existing stores start OFF (no consent given yet).

ALTER TABLE public.merchant_stores
  ADD COLUMN IF NOT EXISTS whatsapp_chat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at  timestamptz;

COMMENT ON COLUMN public.merchant_stores.whatsapp_chat_enabled IS
  'Merchant agreed to receive WhatsApp messages from DealFynd consumers on store_phone.';
COMMENT ON COLUMN public.merchant_stores.whatsapp_consent_at IS
  'When the merchant last turned WhatsApp chat on (null when off / never agreed).';

-- Check:
-- SELECT store_name, store_phone, whatsapp_chat_enabled, whatsapp_consent_at
-- FROM public.merchant_stores ORDER BY created_at DESC LIMIT 20;
