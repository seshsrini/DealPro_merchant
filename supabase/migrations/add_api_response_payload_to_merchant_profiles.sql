-- Append-only audit log of external API responses (KYC/GST verification, etc.)
-- for the merchant. Each entry: { source, doc_type, number, provider, verified,
-- legal_name_match, registry_legal_name, at, response }. Capped to the most
-- recent 100 entries by the writer (verify-business-document).
ALTER TABLE merchant_profiles
  ADD COLUMN IF NOT EXISTS api_response_payload JSONB DEFAULT '[]'::jsonb;
