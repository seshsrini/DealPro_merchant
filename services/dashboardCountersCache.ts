// Lightweight localStorage-backed cache for the merchant dashboard's lifetime counters
// (total deals, total clicks, total redemptions, etc). Values change slowly relative to
// the dashboard's render frequency, so a 5-minute window collapses repeated panel opens
// into a single network call and keeps the dashboard populated when a JWT is briefly
// rejected (cache fallback).

const STORAGE_KEY = 'dealpro_dashboard_counters_cache_v1';
const SCHEMA_VERSION = 1;
const FRESH_TTL_MS = 5 * 60 * 1000; // 5 min — counters update on publish/redeem; this is plenty.

interface PersistedEntry<T> {
  value: T;
  timestamp: number;
}

interface PersistedShape {
  v: number;
  byKey: Record<string, PersistedEntry<any>>;
}

function readAll(): Record<string, PersistedEntry<any>> {
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

function writeAll(byKey: Record<string, PersistedEntry<any>>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION, byKey }));
  } catch { /* quota / disabled — ignore */ }
}

export interface CachedCounterResult<T> {
  value: T;
  ageMs: number;
  isFresh: boolean;
}

/** Lookup a cached counter. Returns null if no entry exists for the key. */
export function loadCachedCounter<T>(key: string): CachedCounterResult<T> | null {
  const all = readAll();
  const entry = all[key];
  if (!entry) return null;
  const ageMs = Date.now() - entry.timestamp;
  return { value: entry.value as T, ageMs, isFresh: ageMs < FRESH_TTL_MS };
}

export function saveCachedCounter<T>(key: string, value: T): void {
  const all = readAll();
  all[key] = { value, timestamp: Date.now() };
  writeAll(all);
}

/** Bust a single counter (call after publishing a new deal, etc.). */
export function clearCachedCounter(key: string): void {
  const all = readAll();
  if (key in all) {
    delete all[key];
    writeAll(all);
  }
}

/** Bust every entry for a given merchant — handy after an action that changes any counter. */
export function clearMerchantCounters(merchantId: string): void {
  const all = readAll();
  let changed = false;
  for (const k of Object.keys(all)) {
    if (k.endsWith(`:${merchantId}`)) {
      delete all[k];
      changed = true;
    }
  }
  if (changed) writeAll(all);
}
