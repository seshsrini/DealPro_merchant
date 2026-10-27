import { StoreLocation } from '../../types';

// Single source of truth for "is this signup data complete?", shared by the
// Address step, the store list, the Review step and the final submit, so every
// gate applies exactly the same rules.

export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[A-Z0-9]{1}$/;
export const PAN_REGEX = /^[A-Z]{3}[CFPB][A-Z][0-9]{4}[A-Z]$/;
export const UDYAM_REGEX = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/i;
export const FSSAI_REGEX = /^[0-9]{14}$/;
export const TRADE_LICENSE_REGEX = /^[A-Z]{2}[A-Z0-9\/\-]{3,20}$/i;

export const isGstValid = (v: string) => GST_REGEX.test(v);
export const isPanValid = (v: string) => PAN_REGEX.test(v);
export const isUdyamValid = (v: string) => UDYAM_REGEX.test(v.toUpperCase());
export const isFssaiValid = (v: string) => FSSAI_REGEX.test(v);
export const isTradeLicenseValid = (v: string) => TRADE_LICENSE_REGEX.test(v.toUpperCase());

/** Minimum length for the merchant's full name and the legal name of business. */
export const MIN_NAME_LENGTH = 2;
export const isNameValid = (v: string | undefined | null) => (v ?? '').trim().length >= MIN_NAME_LENGTH;

const digits = (v: string | undefined | null) => (v ?? '').replace(/\D/g, '');

/** Every field the Address step requires before Continue is enabled. */
export function isStoreComplete(store: StoreLocation | undefined | null): boolean {
  if (!store) return false;
  const phoneOk = digits(store.store_phone).length === 10;
  const altOk = !store.store_phone_alt?.trim() || digits(store.store_phone_alt).length === 10;
  return !!(
    store.store_name?.trim() &&
    store.store_category &&
    store.street?.trim() &&
    store.pincode?.length === 6 &&
    store.city &&
    store.state &&
    phoneOk &&
    altOk &&
    (store.is24hrs || (store.shift1 && store.shift2))
  );
}

/** A store the final submit will send (it filters on city / street / pincode). */
export const hasAddressDetail = (s: StoreLocation | undefined | null) => !!(s && (s.city || s.street || s.pincode));

export interface SignupDocFields {
  businessType: string;
  gstinValue: string;
  panValue: string;
  udyamValue: string;
  fssaiValue: string;
  tradeLicenseValue: string;
}

/**
 * Format-level document check. (The Verification step additionally requires a
 * successful GST verify and the uniqueness checks; this guards the later steps
 * against a draft/profile restored with a missing or malformed document.)
 */
export function isDocumentComplete(d: SignupDocFields): boolean {
  switch (d.businessType) {
    // No 'none' — a business registration is mandatory.
    case 'gstin':
      return isGstValid(d.gstinValue) && isPanValid(d.panValue);
    case 'udyam':
      return isUdyamValid(d.udyamValue);
    case 'fssai':
      return isFssaiValid(d.fssaiValue);
    case 'trade_license':
      return isTradeLicenseValid(d.tradeLicenseValue);
    default:
      return false;
  }
}

export type MissingItem = 'name' | 'legal_name' | 'store' | 'document';

/** What still blocks the final submit — empty when the signup is complete. */
export function signupMissing(state: SignupDocFields & {
  fullName: string;
  storeName: string;
  stores: StoreLocation[];
}): MissingItem[] {
  const missing: MissingItem[] = [];
  if (!isNameValid(state.fullName)) missing.push('name');
  if (!isNameValid(state.storeName)) missing.push('legal_name');
  // Stores with any address detail are the ones the final submit sends (same
  // filter), so each of them must be complete; a blank "added but unused" store
  // is ignored, exactly as the submit ignores it.
  const submitted = state.stores.filter(hasAddressDetail);
  if (submitted.length === 0 || !submitted.every(isStoreComplete)) missing.push('store');
  if (!isDocumentComplete(state)) missing.push('document');
  return missing;
}

/** Translation key for each missing item (contexts/onboardingTranslations.ts). */
export const MISSING_LABEL_KEY: Record<MissingItem, string> = {
  name: 'ob_missing_name',
  legal_name: 'ob_missing_legal_name',
  store: 'ob_missing_store',
  document: 'ob_missing_document',
};

/** The four accepted registrations — there is no "none / unregistered". */
export const BUSINESS_DOC_COLUMN = {
  gstin: 'gstin',
  udyam: 'udyam_no',
  fssai: 'fssai_no',
  trade_license: 'trade_license_no',
} as const;

/**
 * Does this merchant profile carry a business registration? False for
 * business_type 'none' / empty, or when the chosen document's column is
 * explicitly empty. A column that is simply ABSENT from the object (an older
 * cached session that predates it) is not treated as missing — the server
 * (campaign_create_gate) is the authority and the next profile load corrects it.
 */
export function hasBusinessDocument(p: Record<string, any> | null | undefined): boolean {
  if (!p) return false;
  const col = (BUSINESS_DOC_COLUMN as Record<string, string>)[String(p.business_type ?? '')];
  if (!col) return false;
  return !(col in p) || !!String(p[col] ?? '').trim();
}
