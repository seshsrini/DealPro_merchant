-- Contractor codes used to gate merchant signup. Each contractor recruited
-- for merchant acquisition gets a unique `code` they hand out to merchants;
-- merchants type the code at the start of signup and the
-- `validate-invite-code` edge function checks it exists + is active.
--
-- PII note: contains Aadhaar, DOB, mobile, home address. RLS is enabled with
-- no policies — all reads go through the service role from edge functions /
-- admin tooling. Do not expose this table over the anon key.

CREATE TABLE IF NOT EXISTS contractor_codes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT NOT NULL UNIQUE,
  first_name           TEXT,
  last_name            TEXT,
  dob                  DATE,
  home_address_line1   TEXT,
  home_address_line2   TEXT,
  home_city            TEXT,
  home_state           TEXT,
  home_pincode         TEXT,
  servicing_city       TEXT,
  servicing_state      TEXT,
  start_date           DATE,
  aadhaar_card_no      TEXT UNIQUE,
  mobile_number        TEXT UNIQUE,
  active_status        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_date   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Code is the validation lookup — partial index for the common
-- "active code lookup" path used by validate-invite-code.
CREATE INDEX IF NOT EXISTS contractor_codes_active_code_idx
  ON contractor_codes (code)
  WHERE active_status = TRUE;

-- Auto-bump last_modified_date on every UPDATE.
CREATE OR REPLACE FUNCTION contractor_codes_set_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_date = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contractor_codes_set_modified ON contractor_codes;
CREATE TRIGGER contractor_codes_set_modified
  BEFORE UPDATE ON contractor_codes
  FOR EACH ROW EXECUTE FUNCTION contractor_codes_set_modified();

-- RLS: enabled with no policies — service role only.
ALTER TABLE contractor_codes ENABLE ROW LEVEL SECURITY;
