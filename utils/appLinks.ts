// Canonical public links for the two DealFynd apps.
//
// These are the ONLY URLs that should appear in anything a user can send
// outside the app — referral messages, share sheets, emails. The legacy
// dealpro.app signup page they replaced was dead (connection reset), so
// every referral sent before this landed on nothing.

export const PLAY_LISTING_CONSUMER =
  'https://play.google.com/store/apps/details?id=com.dealpro.app';

export const PLAY_LISTING_MERCHANT =
  'https://play.google.com/store/apps/details?id=com.dealpro.merchant';

/**
 * Play listing URL carrying a referral code.
 *
 * The code rides along in Play's `referrer` parameter, which survives the
 * install and is readable via the Play Install Referrer API. We do not read
 * it yet — until we do, the code must ALSO stay visible in the message text
 * so the new merchant can type it in by hand. Do not remove it from the copy.
 */
export const playListingWithReferral = (base: string, referralCode: string): string =>
  `${base}&referrer=${encodeURIComponent(`ref=${referralCode}`)}`;
