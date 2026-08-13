// Reviewer / app-review access.
//
// Lets a designated account — e.g. the phone number you give the Google Play
// review team — use the "Test subscription" button in a PRODUCTION build,
// WITHOUT exposing that button to real merchants. Configure the allow-list with
// the VITE_REVIEWER_PHONES env var (comma-separated 10-digit numbers), e.g.:
//   VITE_REVIEWER_PHONES=9000000011
// The server (merchant-subscription create_test_subscription) enforces the same
// allow-list via REVIEWER_PHONES, so the button can't be exploited by tampering.

export function reviewerPhones(): string[] {
  return String(import.meta.env.VITE_REVIEWER_PHONES || '')
    .split(',')
    .map((s) => s.replace(/\D/g, '').slice(-10))
    .filter(Boolean);
}

/** True when the signed-in user's phone is on the reviewer allow-list. */
export function isReviewerAccount(user: { phone?: string | null } | null | undefined): boolean {
  const phone = String(user?.phone || '').replace(/\D/g, '').slice(-10);
  return !!phone && reviewerPhones().includes(phone);
}
