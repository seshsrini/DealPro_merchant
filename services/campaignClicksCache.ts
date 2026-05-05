const STORAGE_KEY = 'dealpro_campaign_clicks_cache_v1';
const SCHEMA_VERSION = 1;
// Click counts change continuously, so a short window is appropriate. 30 s collapses bursts
// (dashboard mounts, tab switches, auto-refresh polls) into one network call without making
// the displayed counts feel stale to the merchant.
const FRESH_TTL_MS = 30 * 1000;

export interface ClicksPayload {
  views: Record<string, number>;
  claimClicks: Record<string, number>;
}

interface PersistedEntry {
  payload: ClicksPayload;
  timestamp: number;
}

interface PersistedShape {
  v: number;
  byKey: Record<string, PersistedEntry>;
}

// Stable cache key from a list of IDs — order-independent so [a,b] and [b,a] hit the same entry.
export function makeKey(campaignIds: string[]): string {
  return [...campaignIds].sort().join(',');
}

function readAll(): Record<string, PersistedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedShape;
    if (!parsed || parsed.v !== SCHEMA_VERSION || !parsed.byKey) return {};
    return parsed.byKey;
  } catch {
    return {};
  }
}

function writeAll(byKey: Record<string, PersistedEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, byKey }));
  } catch {
    // Storage full or disabled — ignore.
  }
}

export interface CachedClicksResult {
  payload: ClicksPayload;
  ageMs: number;
  isFresh: boolean;
}

export function loadCachedClicks(campaignIds: string[]): CachedClicksResult | null {
  const all = readAll();
  const entry = all[makeKey(campaignIds)];
  if (!entry) return null;
  const ageMs = Date.now() - entry.timestamp;
  return { payload: entry.payload, ageMs, isFresh: ageMs < FRESH_TTL_MS };
}

export function saveCachedClicks(campaignIds: string[], payload: ClicksPayload): void {
  const all = readAll();
  all[makeKey(campaignIds)] = { payload, timestamp: Date.now() };
  // Trim to most recent 20 keys so a merchant churning through filter combinations doesn't bloat localStorage.
  const entries = Object.entries(all).sort((a, b) => b[1].timestamp - a[1].timestamp);
  const trimmed = Object.fromEntries(entries.slice(0, 20));
  writeAll(trimmed);
}

export function clearCachedClicks(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

// ──────────────────────────────────────────────────────────────────────────
// Parallel cache for redemption counts (Record<campaign_id, count>).
// Same TTL + key shape; separate storage key so the two payload shapes don't
// collide and we can evict each independently.
// ──────────────────────────────────────────────────────────────────────────
const REDEMPTIONS_STORAGE_KEY = 'dealpro_campaign_redemptions_cache_v1';

export interface CachedRedemptionsResult {
  counts: Record<string, number>;
  ageMs: number;
  isFresh: boolean;
}

interface PersistedRedemptionsEntry {
  counts: Record<string, number>;
  timestamp: number;
}

interface PersistedRedemptionsShape {
  v: number;
  byKey: Record<string, PersistedRedemptionsEntry>;
}

function readAllRedemptions(): Record<string, PersistedRedemptionsEntry> {
  try {
    const raw = localStorage.getItem(REDEMPTIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedRedemptionsShape;
    if (!parsed || parsed.v !== SCHEMA_VERSION || !parsed.byKey) return {};
    return parsed.byKey;
  } catch {
    return {};
  }
}

function writeAllRedemptions(byKey: Record<string, PersistedRedemptionsEntry>): void {
  try {
    localStorage.setItem(REDEMPTIONS_STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, byKey }));
  } catch { /* quota / disabled */ }
}

export function loadCachedRedemptions(merchantId: string, campaignIds: string[]): CachedRedemptionsResult | null {
  const all = readAllRedemptions();
  const entry = all[`${merchantId}|${makeKey(campaignIds)}`];
  if (!entry) return null;
  const ageMs = Date.now() - entry.timestamp;
  return { counts: entry.counts, ageMs, isFresh: ageMs < FRESH_TTL_MS };
}

export function saveCachedRedemptions(merchantId: string, campaignIds: string[], counts: Record<string, number>): void {
  const all = readAllRedemptions();
  all[`${merchantId}|${makeKey(campaignIds)}`] = { counts, timestamp: Date.now() };
  // Trim to most-recent 20 entries to bound localStorage growth.
  const entries = Object.entries(all).sort((a, b) => b[1].timestamp - a[1].timestamp);
  const trimmed = Object.fromEntries(entries.slice(0, 20));
  writeAllRedemptions(trimmed);
}

export function clearCachedRedemptions(): void {
  try { localStorage.removeItem(REDEMPTIONS_STORAGE_KEY); } catch { /* noop */ }
}
