// friendlyError — one place that turns ANY raw error (server / network / SDK)
// into a clear, merchant-appropriate message. The rule everywhere errors are
// shown: LOG the raw message (for debugging), SHOW the friendly one. A merchant
// must never see an internal/technical string or another role's vocabulary
// (e.g. "Consumer ID is required" surfaced during a deal publish).

/** Pull a message string out of the many error shapes we get (Error, supabase
 *  FunctionsError, { error }, plain string, etc.). */
export function extractRawMessage(err: any): string {
  if (!err) return '';
  if (typeof err === 'string') return err.trim();
  const m =
    err.message ??
    err.error_description ??
    (typeof err.error === 'string' ? err.error : err.error?.message) ??
    err.msg ??
    err.details ??
    '';
  return String(m || '').trim();
}

// Auth/session problems — reopening the app recovers the token.
const SESSION_RE = /session|expired|log ?in|unauthor|invalid token|jwt|refresh token/i;

// Network/connectivity — a retry usually works.
const NETWORK_RE = /failed to fetch|network|timeout|timed out|connection|offline|socket|econn|fetch failed/i;

// Internal / technical / wrong-audience strings that must NEVER be shown to a
// merchant, even if they happen to contain an "actionable"-looking word. These
// are caught FIRST so they always fall back to the generic message.
const BLOCK_RE =
  /consumer id|merchant id mismatch|column .* does not exist|relation .* does not exist|foreign key|fkey|null value|violates|constraint|duplicate key|syntax error|undefined|cannot read|is not a function|stack|edge function returned|non-2xx|status code|internal server|\b5\d\d\b|deno|supabase|rpc|pgrst|22\d{3}|23\d{3}|42\d{3}/i;

// Messages that are already clear AND merchant-actionable — safe to show as-is.
const ACTIONABLE_RE =
  /subscription|active deal|plan|inappropriate|sexual|hateful|threat|guidelines|moderation|image|video|photo|cover|store|heading|offer|description|category|go back|re-?select|re-?upload|already (registered|claimed|exists)|name doesn'?t match|registered as|stock|price|gst|udyam|fssai|trade licen|verify|invalid .* format|must be|please (pick|choose|select|enter|add)|at least|too (large|long|short|many)|limit/i;

export interface FriendlyOpts {
  /** What the user was trying to do — used to tailor the generic fallback,
   *  e.g. "publish your deal", "load your plans", "save your product". */
  action?: string;
  /** Tag for the console log of the raw (unmapped) message. */
  tag?: string;
}

/**
 * Map a raw error to a merchant-friendly message.
 *  - session/auth  → reopen-the-app guidance
 *  - network       → check-connection guidance
 *  - blocked       → generic fallback (never leak internal strings)
 *  - actionable    → shown as-is (it's already clear)
 *  - anything else → generic fallback (and the raw is logged)
 */
export function toMerchantMessage(err: any, opts: FriendlyOpts = {}): string {
  const raw = extractRawMessage(err);
  const lc = raw.toLowerCase();
  const tag = opts.tag ? ` ${opts.tag}` : '';

  if (SESSION_RE.test(lc)) {
    return 'Your session timed out. Please close and reopen the app, then try again.';
  }
  if (NETWORK_RE.test(lc)) {
    return 'Network problem — please check your connection and try again.';
  }
  if (raw && !BLOCK_RE.test(lc) && ACTIONABLE_RE.test(lc)) {
    return raw; // already a clear, merchant-appropriate message
  }

  // Unrecognized or internal — log the raw for debugging, show a clear next step.
  if (raw) console.warn(`[friendlyError]${tag} unmapped/blocked raw error:`, raw);
  const what = opts.action ? `We couldn't ${opts.action} just now.` : 'Something went wrong.';
  return `${what} Please try again. If it keeps happening, close and reopen the app, then retry.`;
}
